package sqlite

import (
	"database/sql"

	"github.com/google/uuid"

	"image-storage/apps/api/internal/domain"
)

type TagRepo struct {
	store *Store
}

func (r *TagRepo) ListByUser(userID string) ([]domain.Tag, error) {
	rows, err := r.store.DB.Query(`
		SELECT t.id, t.name, COUNT(it.image_id) AS cnt
		FROM tags t
		LEFT JOIN image_tags it ON it.tag_id = t.id
		LEFT JOIN images i ON i.id = it.image_id AND i.deleted_at IS NULL
		WHERE t.user_id = ?
		GROUP BY t.id, t.name
		ORDER BY t.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Tag{}
	for rows.Next() {
		var t domain.Tag
		if err := rows.Scan(&t.ID, &t.Name, &t.ImageCount); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *TagRepo) SetImageTags(userID, imageID string, tagNames []string, now string) error {
	var owner string
	if err := r.store.DB.QueryRow(
		`SELECT user_id FROM images WHERE id = ? AND deleted_at IS NULL`,
		imageID,
	).Scan(&owner); err != nil || owner != userID {
		return domain.ErrNotFound
	}
	tx, err := r.store.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM image_tags WHERE image_id = ?`, imageID); err != nil {
		return err
	}
	for _, name := range tagNames {
		tagID, err := upsertTag(tx, userID, name, now)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?, ?)`, imageID, tagID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func upsertTag(tx *sql.Tx, userID, name, now string) (string, error) {
	var id string
	err := tx.QueryRow(`SELECT id FROM tags WHERE user_id = ? AND name = ?`, userID, name).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err != sql.ErrNoRows {
		return "", err
	}
	id = uuid.NewString()
	_, err = tx.Exec(`INSERT INTO tags (id, user_id, name, created_at) VALUES (?, ?, ?, ?)`, id, userID, name, now)
	return id, err
}
