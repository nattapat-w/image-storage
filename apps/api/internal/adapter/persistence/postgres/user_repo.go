package postgres

import (
	"database/sql"
	"strings"

	"image-storage/apps/api/internal/domain"
)

type UserRepo struct {
	store *Store
}

func (r *UserRepo) Create(user domain.User, passwordHash, createdAt string) error {
	_, err := r.store.DB.Exec(
		`INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		user.ID, user.Email, passwordHash, user.DisplayName, createdAt, createdAt,
	)
	if err != nil && strings.Contains(err.Error(), "unique") {
		return domain.ErrConflict
	}
	return err
}

func (r *UserRepo) FindByEmail(email string) (domain.User, string, error) {
	var u domain.User
	var hash string
	err := r.store.DB.QueryRow(
		`SELECT id, email, COALESCE(display_name, ''), password_hash, auto_tag_enabled, created_at FROM users WHERE LOWER(email) = LOWER($1)`,
		email,
	).Scan(&u.ID, &u.Email, &u.DisplayName, &hash, &u.AutoTagEnabled, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return u, "", domain.ErrNotFound
	}
	return u, hash, err
}

func (r *UserRepo) FindByID(id string) (domain.User, error) {
	var u domain.User
	err := r.store.DB.QueryRow(
		`SELECT id, email, COALESCE(display_name, ''), auto_tag_enabled, created_at FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.DisplayName, &u.AutoTagEnabled, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return u, domain.ErrNotFound
	}
	return u, err
}

func (r *UserRepo) UpdateProfile(id, email, displayName, updatedAt string) error {
	res, err := r.store.DB.Exec(
		`UPDATE users SET email = $1, display_name = $2, updated_at = $3 WHERE id = $4`,
		email, displayName, updatedAt, id,
	)
	if err != nil && strings.Contains(err.Error(), "unique") {
		return domain.ErrConflict
	}
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *UserRepo) UpdateAutoTagEnabled(id string, enabled bool, updatedAt string) error {
	res, err := r.store.DB.Exec(
		`UPDATE users SET auto_tag_enabled = $1, updated_at = $2 WHERE id = $3`,
		enabled, updatedAt, id,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *UserRepo) UpdatePassword(id, passwordHash, updatedAt string) error {
	res, err := r.store.DB.Exec(
		`UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`,
		passwordHash, updatedAt, id,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *UserRepo) Delete(id string) error {
	res, err := r.store.DB.Exec(`DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}
