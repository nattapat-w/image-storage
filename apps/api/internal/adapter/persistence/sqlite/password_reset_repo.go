package sqlite

import (
	"database/sql"

	"image-storage/apps/api/internal/domain"
)

type PasswordResetRepo struct {
	store *Store
}

func (r *PasswordResetRepo) Create(userID, tokenHash, expiresAt, createdAt string) error {
	_, err := r.store.DB.Exec(
		`DELETE FROM password_reset_tokens WHERE user_id = ?`,
		userID,
	)
	if err != nil {
		return err
	}
	_, err = r.store.DB.Exec(
		`INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)`,
		userID, tokenHash, expiresAt, createdAt,
	)
	return err
}

func (r *PasswordResetRepo) FindUserIDByTokenHash(tokenHash string, now string) (string, error) {
	var userID string
	err := r.store.DB.QueryRow(
		`SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ?`,
		tokenHash, now,
	).Scan(&userID)
	if err == sql.ErrNoRows {
		return "", domain.ErrNotFound
	}
	return userID, err
}

func (r *PasswordResetRepo) DeleteByUser(userID string) error {
	_, err := r.store.DB.Exec(`DELETE FROM password_reset_tokens WHERE user_id = ?`, userID)
	return err
}

func (r *PasswordResetRepo) DeleteToken(tokenHash string) error {
	_, err := r.store.DB.Exec(`DELETE FROM password_reset_tokens WHERE token_hash = ?`, tokenHash)
	return err
}
