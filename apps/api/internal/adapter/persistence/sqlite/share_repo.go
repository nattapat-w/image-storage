package sqlite

import (
	"database/sql"

	"image-storage/apps/api/internal/domain"
)

type ShareRepo struct {
	store *Store
}

func (r *ShareRepo) Create(share domain.Share) error {
	_, err := r.store.DB.Exec(
		`INSERT INTO shares (id, user_id, resource_type, resource_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		share.ID, share.UserID, share.ResourceType, share.ResourceID, share.Token, nullStrPtr(share.ExpiresAt), share.CreatedAt,
	)
	return err
}

func (r *ShareRepo) ListByResource(userID, resourceType, resourceID string) ([]domain.Share, error) {
	rows, err := r.store.DB.Query(
		`SELECT id, resource_type, resource_id, token, expires_at, created_at FROM shares WHERE user_id = ? AND resource_type = ? AND resource_id = ?`,
		userID, resourceType, resourceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Share{}
	for rows.Next() {
		s, err := scanShare(rows)
		if err != nil {
			return nil, err
		}
		s.UserID = userID
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *ShareRepo) Delete(userID, id string) error {
	res, err := r.store.DB.Exec(`DELETE FROM shares WHERE id = ? AND user_id = ?`, id, userID)
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
	row := r.store.DB.QueryRow(
		`SELECT id, user_id, resource_type, resource_id, token, expires_at, created_at FROM shares WHERE token = ?`,
		token,
	)
	s, err := scanShareWithOwner(row)
	if err == sql.ErrNoRows {
		return s, domain.ErrNotFound
	}
	return s, err
}

func (r *ShareRepo) OwnsResource(userID, typ, id string) bool {
	switch typ {
	case domain.ResourceImage:
		var owner string
		err := r.store.DB.QueryRow(`SELECT user_id FROM images WHERE id = ?`, id).Scan(&owner)
		return err == nil && owner == userID
	case domain.ResourceFolder:
		var owner string
		err := r.store.DB.QueryRow(`SELECT user_id FROM folders WHERE id = ?`, id).Scan(&owner)
		return err == nil && owner == userID
	}
	return false
}

type shareScanner interface {
	Scan(dest ...any) error
}

func scanShare(row shareScanner) (domain.Share, error) {
	var s domain.Share
	var exp sql.NullString
	if err := row.Scan(&s.ID, &s.ResourceType, &s.ResourceID, &s.Token, &exp, &s.CreatedAt); err != nil {
		return s, err
	}
	if exp.Valid {
		s.ExpiresAt = &exp.String
	}
	return s, nil
}

func scanShareWithOwner(row shareScanner) (domain.Share, error) {
	var s domain.Share
	var exp sql.NullString
	if err := row.Scan(&s.ID, &s.UserID, &s.ResourceType, &s.ResourceID, &s.Token, &exp, &s.CreatedAt); err != nil {
		return s, err
	}
	if exp.Valid {
		s.ExpiresAt = &exp.String
	}
	return s, nil
}
