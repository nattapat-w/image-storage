package postgres

import (
	"database/sql"
	"fmt"
	"strings"

	"image-storage/apps/api/internal/domain"
)

const imageSelectCols = `id, folder_id, name, mime_type, size, visibility, favorite, content_hash, taken_at, deleted_at, created_at, updated_at`

func scanImageRows(rows *sql.Rows) (domain.Image, error) {
	var img domain.Image
	var folder, contentHash, takenAt, deletedAt sql.NullString
	var favorite bool
	err := rows.Scan(
		&img.ID, &folder, &img.Name, &img.MimeType, &img.Size, &img.Visibility,
		&favorite, &contentHash, &takenAt, &deletedAt, &img.CreatedAt, &img.UpdatedAt,
	)
	if err != nil {
		return img, err
	}
	if folder.Valid {
		img.FolderID = &folder.String
	}
	img.Favorite = favorite
	if contentHash.Valid {
		img.ContentHash = contentHash.String
	}
	if takenAt.Valid {
		img.TakenAt = &takenAt.String
	}
	if deletedAt.Valid {
		img.DeletedAt = &deletedAt.String
	}
	img.Tags = []string{}
	return img, nil
}

func scanImageRow(row *sql.Row) (domain.Image, error) {
	var img domain.Image
	var folder, contentHash, takenAt, deletedAt sql.NullString
	var favorite bool
	err := row.Scan(
		&img.ID, &folder, &img.Name, &img.MimeType, &img.Size, &img.Visibility,
		&favorite, &contentHash, &takenAt, &deletedAt, &img.CreatedAt, &img.UpdatedAt,
	)
	if err != nil {
		return img, err
	}
	if folder.Valid {
		img.FolderID = &folder.String
	}
	img.Favorite = favorite
	if contentHash.Valid {
		img.ContentHash = contentHash.String
	}
	if takenAt.Valid {
		img.TakenAt = &takenAt.String
	}
	if deletedAt.Valid {
		img.DeletedAt = &deletedAt.String
	}
	img.Tags = []string{}
	return img, nil
}

func attachTags(db *sql.DB, images []domain.Image) error {
	if len(images) == 0 {
		return nil
	}
	ids := make([]string, len(images))
	byID := make(map[string]int, len(images))
	for i, img := range images {
		ids[i] = img.ID
		byID[img.ID] = i
	}
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}
	q := `SELECT it.image_id, t.name FROM image_tags it JOIN tags t ON t.id = it.tag_id WHERE it.image_id IN (` + strings.Join(placeholders, ",") + `) ORDER BY t.name`
	rows, err := db.Query(q, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var imageID, name string
		if err := rows.Scan(&imageID, &name); err != nil {
			return err
		}
		if idx, ok := byID[imageID]; ok {
			images[idx].Tags = append(images[idx].Tags, name)
		}
	}
	return rows.Err()
}
