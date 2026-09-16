package sqlite

import (
	"database/sql"
	"strings"

	"image-storage/apps/api/internal/domain"
)

type ImageRepo struct {
	store *Store
}

func (r *ImageRepo) List(filter domain.ImageListFilter) ([]domain.Image, error) {
	if filter.Sort == "" {
		filter.Sort = "name"
	}
	orderCol := "name"
	switch filter.Sort {
	case "date":
		orderCol = "created_at DESC"
	case "size":
		orderCol = "size DESC"
	case "timeline":
		orderCol = "COALESCE(taken_at, created_at) DESC"
	default:
		orderCol = "name"
	}

	var sb strings.Builder
	args := []any{filter.UserID}
	sb.WriteString(`SELECT ` + imageSelectCols + ` FROM images WHERE user_id = ?`)

	if filter.Trash {
		sb.WriteString(` AND deleted_at IS NOT NULL`)
	} else {
		sb.WriteString(` AND deleted_at IS NULL`)
	}
	if filter.Favorite {
		sb.WriteString(` AND favorite = 1`)
	}
	if filter.Tag != "" {
		sb.WriteString(` AND id IN (
			SELECT it.image_id FROM image_tags it
			JOIN tags t ON t.id = it.tag_id
			WHERE t.user_id = ? AND t.name = ?
		)`)
		args = append(args, filter.UserID, strings.ToLower(filter.Tag))
	}
	if !filter.Trash && !filter.Favorite && filter.Tag == "" && filter.Sort != "timeline" {
		if filter.FolderID == "" {
			sb.WriteString(` AND folder_id IS NULL`)
		} else {
			sb.WriteString(` AND folder_id = ?`)
			args = append(args, filter.FolderID)
		}
	}
	sb.WriteString(` ORDER BY ` + orderCol)

	rows, err := r.store.DB.Query(sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.Image{}
	for rows.Next() {
		img, err := scanImageRows(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, img)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := attachTags(r.store.DB, out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *ImageRepo) GetOwned(userID, id string) (domain.Image, error) {
	row := r.store.DB.QueryRow(
		`SELECT `+imageSelectCols+` FROM images WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
		id, userID,
	)
	img, err := scanImageRow(row)
	if err == sql.ErrNoRows {
		return img, domain.ErrNotFound
	}
	if err != nil {
		return img, err
	}
	images := []domain.Image{img}
	if err := attachTags(r.store.DB, images); err != nil {
		return domain.Image{}, err
	}
	return images[0], nil
}

func (r *ImageRepo) GetByID(id string) (domain.Image, error) {
	row := r.store.DB.QueryRow(`SELECT `+imageSelectCols+` FROM images WHERE id = ? AND deleted_at IS NULL`, id)
	img, err := scanImageRow(row)
	if err == sql.ErrNoRows {
		return img, domain.ErrNotFound
	}
	if err != nil {
		return img, err
	}
	images := []domain.Image{img}
	if err := attachTags(r.store.DB, images); err != nil {
		return domain.Image{}, err
	}
	return images[0], nil
}

func (r *ImageRepo) FindActiveByHash(userID, hash string) (string, error) {
	var existingID string
	err := r.store.DB.QueryRow(
		`SELECT id FROM images WHERE user_id = ? AND content_hash = ? AND deleted_at IS NULL`,
		userID, hash,
	).Scan(&existingID)
	if err == sql.ErrNoRows {
		return "", domain.ErrNotFound
	}
	return existingID, err
}

func (r *ImageRepo) GetFileMeta(id string) (domain.ImageFile, error) {
	var f domain.ImageFile
	var deletedAt sql.NullString
	err := r.store.DB.QueryRow(
		`SELECT storage_key, mime_type, name, visibility, user_id, deleted_at FROM images WHERE id = ?`,
		id,
	).Scan(&f.StorageKey, &f.MimeType, &f.Name, &f.Visibility, &f.OwnerID, &deletedAt)
	if err == sql.ErrNoRows {
		return f, domain.ErrNotFound
	}
	if err != nil {
		return f, err
	}
	f.Deleted = deletedAt.Valid
	return f, nil
}

func (r *ImageRepo) Insert(userID string, img domain.Image, storageKey string) error {
	var folder any
	if img.FolderID != nil {
		folder = *img.FolderID
	}
	fav := 0
	if img.Favorite {
		fav = 1
	}
	_, err := r.store.DB.Exec(
		`INSERT INTO images (id, user_id, folder_id, name, mime_type, size, storage_key, visibility, favorite, content_hash, taken_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		img.ID, userID, folder, img.Name, img.MimeType, img.Size, storageKey,
		img.Visibility, fav, img.ContentHash, img.TakenAt, img.CreatedAt, img.UpdatedAt,
	)
	return err
}

func (r *ImageRepo) Update(userID, id string, upd domain.ImageUpdate, updatedAt string) error {
	if _, err := r.GetOwned(userID, id); err != nil {
		return err
	}
	if upd.Name != nil {
		_, err := r.store.DB.Exec(`UPDATE images SET name = ?, updated_at = ? WHERE id = ?`, *upd.Name, updatedAt, id)
		if err != nil {
			return err
		}
	}
	if upd.FolderID != nil {
		if *upd.FolderID != "" {
			_, err := r.store.DB.Exec(`UPDATE images SET folder_id = ?, updated_at = ? WHERE id = ?`, *upd.FolderID, updatedAt, id)
			if err != nil {
				return err
			}
		} else {
			_, err := r.store.DB.Exec(`UPDATE images SET folder_id = NULL, updated_at = ? WHERE id = ?`, updatedAt, id)
			if err != nil {
				return err
			}
		}
	}
	if upd.Visibility != nil {
		_, err := r.store.DB.Exec(`UPDATE images SET visibility = ?, updated_at = ? WHERE id = ?`, *upd.Visibility, updatedAt, id)
		if err != nil {
			return err
		}
	}
	if upd.Favorite != nil {
		fav := 0
		if *upd.Favorite {
			fav = 1
		}
		_, err := r.store.DB.Exec(`UPDATE images SET favorite = ?, updated_at = ? WHERE id = ?`, fav, updatedAt, id)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *ImageRepo) SoftDelete(userID, id, deletedAt string) error {
	err := r.store.DB.QueryRow(
		`SELECT id FROM images WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
		id, userID,
	).Scan(new(string))
	if err == sql.ErrNoRows {
		return domain.ErrNotFound
	}
	if err != nil {
		return err
	}
	_, err = r.store.DB.Exec(`UPDATE images SET deleted_at = ?, updated_at = ? WHERE id = ?`, deletedAt, deletedAt, id)
	return err
}

func (r *ImageRepo) Restore(userID, id, updatedAt string) error {
	err := r.store.DB.QueryRow(
		`SELECT id FROM images WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
		id, userID,
	).Scan(new(string))
	if err == sql.ErrNoRows {
		return domain.ErrNotFound
	}
	if err != nil {
		return err
	}
	_, err = r.store.DB.Exec(`UPDATE images SET deleted_at = NULL, updated_at = ? WHERE id = ?`, updatedAt, id)
	return err
}

func (r *ImageRepo) PurgeAll(userID string) ([]string, error) {
	rows, err := r.store.DB.Query(`SELECT storage_key FROM images WHERE user_id = ?`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	keys := []string{}
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	tx, err := r.store.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(
		`DELETE FROM shares WHERE user_id = ? AND resource_type = 'image'`,
		userID,
	); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(`DELETE FROM images WHERE user_id = ?`, userID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return keys, nil
}

func (r *ImageRepo) PermanentDelete(userID, id string) (string, error) {
	var key string
	err := r.store.DB.QueryRow(
		`SELECT storage_key FROM images WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
		id, userID,
	).Scan(&key)
	if err == sql.ErrNoRows {
		return "", domain.ErrNotFound
	}
	if err != nil {
		return "", err
	}
	_, err = r.store.DB.Exec(`DELETE FROM images WHERE id = ?`, id)
	return key, err
}

func (r *ImageRepo) IsOwned(userID, id string) bool {
	var owner string
	err := r.store.DB.QueryRow(`SELECT user_id FROM images WHERE id = ? AND deleted_at IS NULL`, id).Scan(&owner)
	return err == nil && owner == userID
}

func (r *ImageRepo) IsInFolderTree(imageID, rootFolderID string) bool {
	var folderID sql.NullString
	if err := r.store.DB.QueryRow(`SELECT folder_id FROM images WHERE id = ?`, imageID).Scan(&folderID); err != nil {
		return false
	}
	if !folderID.Valid {
		return false
	}
	current := folderID.String
	for {
		if current == rootFolderID {
			return true
		}
		var parent sql.NullString
		if err := r.store.DB.QueryRow(`SELECT parent_id FROM folders WHERE id = ?`, current).Scan(&parent); err != nil || !parent.Valid {
			return false
		}
		current = parent.String
	}
}

func (r *ImageRepo) ListInFolder(userID string, folderID *string) ([]domain.Image, error) {
	var rows *sql.Rows
	var err error
	if folderID == nil {
		rows, err = r.store.DB.Query(
			`SELECT `+imageSelectCols+` FROM images WHERE user_id = ? AND folder_id IS NULL AND deleted_at IS NULL ORDER BY name`,
			userID,
		)
	} else {
		rows, err = r.store.DB.Query(
			`SELECT `+imageSelectCols+` FROM images WHERE user_id = ? AND folder_id = ? AND deleted_at IS NULL ORDER BY name`,
			userID, *folderID,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Image{}
	for rows.Next() {
		img, err := scanImageRows(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, img)
	}
	return out, rows.Err()
}
