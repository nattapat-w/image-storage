package postgres

import (
	"database/sql"

	"image-storage/apps/api/internal/domain"
)

type ShareRepo struct {
	store *Store
}

func (r *ShareRepo) Create(share domain.Share) error {
	_, err := r.store.DB.Exec(
		`INSERT INTO shares (id, user_id, resource_type, resource_id, token, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		share.ID, share.UserID, share.ResourceType, share.ResourceID, share.Token, share.CreatedAt,
	)
	return err
}

func (r *ShareRepo) ListByResource(userID, resourceType, resourceID string) ([]domain.Share, error) {
	rows, err := r.store.DB.Query(
		`SELECT id, resource_type, resource_id, token, created_at FROM shares WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3`,
		userID, resourceType, resourceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Share{}
	for rows.Next() {
		var s domain.Share
		if err := rows.Scan(&s.ID, &s.ResourceType, &s.ResourceID, &s.Token, &s.CreatedAt); err != nil {
			return nil, err
		}
		s.UserID = userID
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *ShareRepo) Delete(userID, id string) error {
	res, err := r.store.DB.Exec(`DELETE FROM shares WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *ShareRepo) FindByToken(token string) (domain.Share, error) {
	var s domain.Share
	err := r.store.DB.QueryRow(
		`SELECT id, user_id, resource_type, resource_id, token, created_at FROM shares WHERE token = $1`,
		token,
	).Scan(&s.ID, &s.UserID, &s.ResourceType, &s.ResourceID, &s.Token, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return s, domain.ErrNotFound
	}
	return s, err
}

func (r *ShareRepo) OwnsResource(userID, typ, id string) bool {
	switch typ {
	case domain.ResourceImage:
		var owner string
		err := r.store.DB.QueryRow(`SELECT user_id FROM images WHERE id = $1`, id).Scan(&owner)
		return err == nil && owner == userID
	case domain.ResourceFolder:
		var owner string
		err := r.store.DB.QueryRow(`SELECT user_id FROM folders WHERE id = $1`, id).Scan(&owner)
		return err == nil && owner == userID
	}
	return false
}
