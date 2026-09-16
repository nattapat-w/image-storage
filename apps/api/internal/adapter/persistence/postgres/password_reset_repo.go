package postgres

import (
	"database/sql"

	"github.com/google/uuid"

	"image-storage/apps/api/internal/domain"
)

type PasswordResetRepo struct {
	store *Store
}

func (r *PasswordResetRepo) Create(userID, tokenHash, expiresAt, createdAt string) error {
	_, err := r.store.DB.Exec(
		`DELETE FROM password_reset_tokens WHERE user_id = $1`,
		userID,
	)
	if err != nil {
		return err
	}
	_, err = r.store.DB.Exec(
		`INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)`,
		uuid.NewString(), userID, tokenHash, expiresAt, createdAt,
	)
	return err
}

func (r *PasswordResetRepo) FindUserIDByTokenHash(tokenHash string, now string) (string, error) {
	var userID string
	err := r.store.DB.QueryRow(
		`SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > $2`,
		tokenHash, now,
	).Scan(&userID)
	if err == sql.ErrNoRows {
		return "", domain.ErrNotFound
	}
	return userID, err
}

func (r *PasswordResetRepo) DeleteByUser(userID string) error {
	_, err := r.store.DB.Exec(`DELETE FROM password_reset_tokens WHERE user_id = $1`, userID)
	return err
}

func (r *PasswordResetRepo) DeleteToken(tokenHash string) error {
	_, err := r.store.DB.Exec(`DELETE FROM password_reset_tokens WHERE token_hash = $1`, tokenHash)
	return err
}
