package postgres

import (
	"database/sql"

	"image-storage/apps/api/internal/domain"
)

type NotificationRepo struct {
	store *Store
}

func (r *NotificationRepo) Upsert(n domain.Notification) error {
	_, err := r.store.DB.Exec(`
INSERT INTO notifications (id, user_id, type, title, body, href, ref_type, ref_id, read_at, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (user_id, ref_type, ref_id) DO UPDATE SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  href = EXCLUDED.href`,
		n.ID, n.UserID, n.Type, n.Title, n.Body, n.Href, n.RefType, n.RefID, nullIfEmptyPtr(n.ReadAt), n.CreatedAt,
	)
	return err
}

func (r *NotificationRepo) ListForUser(userID string, limit int) ([]domain.Notification, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.store.DB.Query(`
SELECT id, user_id, type, title, body, href, ref_type, ref_id, read_at, created_at
FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanNotifications(rows)
}

func (r *NotificationRepo) MarkRead(userID, id, readAt string) error {
	res, err := r.store.DB.Exec(`
UPDATE notifications SET read_at = $1 WHERE id = $2 AND user_id = $3 AND read_at IS NULL`,
		readAt, id, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *NotificationRepo) MarkAllRead(userID, readAt string) error {
	_, err := r.store.DB.Exec(`
UPDATE notifications SET read_at = $1 WHERE user_id = $2 AND read_at IS NULL`, readAt, userID)
	return err
}

func (r *NotificationRepo) MarkReadByRef(userID, refType, refID, readAt string) error {
	_, err := r.store.DB.Exec(`
UPDATE notifications SET read_at = $1
WHERE user_id = $2 AND ref_type = $3 AND ref_id = $4 AND read_at IS NULL`,
		readAt, userID, refType, refID)
	return err
}

func scanNotifications(rows *sql.Rows) ([]domain.Notification, error) {
	out := []domain.Notification{}
	for rows.Next() {
		var n domain.Notification
		var read sql.NullString
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &n.Href, &n.RefType, &n.RefID, &read, &n.CreatedAt,
		); err != nil {
			return nil, err
		}
		if read.Valid {
			n.ReadAt = &read.String
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func nullIfEmptyPtr(s *string) any {
	if s == nil || *s == "" {
		return nil
	}
	return *s
}
