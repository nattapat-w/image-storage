package postgres

import (
	"database/sql"

	"image-storage/apps/api/internal/domain"
)

type FolderRepo struct {
	store *Store
}

func (r *FolderRepo) ListChildren(userID string, parentID *string) ([]domain.Folder, error) {
	var rows *sql.Rows
	var err error
	if parentID == nil {
		rows, err = r.store.DB.Query(
			`SELECT id, parent_id, name, is_share_folder, created_at, updated_at FROM folders WHERE user_id = $1 AND parent_id IS NULL ORDER BY name`,
			userID,
		)
	} else {
		rows, err = r.store.DB.Query(
			`SELECT id, parent_id, name, is_share_folder, created_at, updated_at FROM folders WHERE user_id = $1 AND parent_id = $2 ORDER BY name`,
			userID, *parentID,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats, _ := r.StatsByUser(userID)
	out := []domain.Folder{}
	for rows.Next() {
		f, err := scanFolderRow(rows)
		if err != nil {
			return nil, err
		}
		if st, ok := stats[f.ID]; ok {
			f.ImageCount = st.ImageCount
			f.TotalSize = st.TotalSize
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *FolderRepo) Create(userID string, folder domain.Folder) error {
	var parent any
	if folder.ParentID != nil {
		parent = *folder.ParentID
	}
	_, err := r.store.DB.Exec(
		`INSERT INTO folders (id, user_id, parent_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		folder.ID, userID, parent, folder.Name, folder.CreatedAt, folder.UpdatedAt,
	)
	return err
}

func (r *FolderRepo) Get(userID, id string) (domain.Folder, error) {
	row := r.store.DB.QueryRow(
		`SELECT id, parent_id, name, is_share_folder, created_at, updated_at FROM folders WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	f, err := scanFolderRow(row)
	if err == sql.ErrNoRows {
		return f, domain.ErrNotFound
	}
	if err != nil {
		return f, err
	}
	stats, _ := r.StatsByUser(userID)
	if st, ok := stats[f.ID]; ok {
		f.ImageCount = st.ImageCount
		f.TotalSize = st.TotalSize
	}
	return f, nil
}

func (r *FolderRepo) UpdateName(userID, id, name, updatedAt string) error {
	res, err := r.store.DB.Exec(
		`UPDATE folders SET name = $1, updated_at = $2 WHERE id = $3 AND user_id = $4`,
		name, updatedAt, id, userID,
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

func (r *FolderRepo) UpdateParent(userID, id string, parentID *string, updatedAt string) error {
	var parent any
	if parentID != nil {
		parent = *parentID
	}
	res, err := r.store.DB.Exec(
		`UPDATE folders SET parent_id = $1, updated_at = $2 WHERE id = $3 AND user_id = $4`,
		parent, updatedAt, id, userID,
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

func (r *FolderRepo) Delete(userID, id string) error {
	if !r.Owns(userID, id) {
		return domain.ErrNotFound
	}
	_, _ = r.store.DB.Exec(
		`DELETE FROM shares WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3`,
		userID, domain.ResourceFolder, id,
	)
	res, err := r.store.DB.Exec(`DELETE FROM folders WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *FolderRepo) PurgeAll(userID string) (int, error) {
	_, err := r.store.DB.Exec(
		`DELETE FROM shares WHERE user_id = $1 AND resource_type = $2`,
		userID, domain.ResourceFolder,
	)
	if err != nil {
		return 0, err
	}
	res, err := r.store.DB.Exec(`DELETE FROM folders WHERE user_id = $1`, userID)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

func (r *FolderRepo) Owns(userID, id string) bool {
	var owner string
	err := r.store.DB.QueryRow(`SELECT user_id FROM folders WHERE id = $1`, id).Scan(&owner)
	return err == nil && owner == userID
}

func (r *FolderRepo) Breadcrumb(userID, folderID string) ([]domain.Breadcrumb, error) {
	if folderID == "" {
		return []domain.Breadcrumb{}, nil
	}
	if !r.Owns(userID, folderID) {
		return nil, domain.ErrNotFound
	}
	crumbs := []domain.Breadcrumb{}
	current := folderID
	for current != "" {
		var id, name string
		var parent sql.NullString
		err := r.store.DB.QueryRow(
			`SELECT id, name, parent_id FROM folders WHERE id = $1 AND user_id = $2`,
			current, userID,
		).Scan(&id, &name, &parent)
		if err == sql.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		if err != nil {
			return nil, err
		}
		crumbs = append([]domain.Breadcrumb{{ID: id, Name: name}}, crumbs...)
		if !parent.Valid {
			break
		}
		current = parent.String
	}
	return crumbs, nil
}

func (r *FolderRepo) ListRows(userID string) ([]domain.FolderRow, error) {
	rows, err := r.store.DB.Query(
		`SELECT id, parent_id, name, is_share_folder FROM folders WHERE user_id = $1 ORDER BY name`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.FolderRow{}
	for rows.Next() {
		var row domain.FolderRow
		var parent sql.NullString
		var isShare bool
		if err := rows.Scan(&row.ID, &parent, &row.Name, &isShare); err != nil {
			return nil, err
		}
		if parent.Valid {
			row.ParentID = &parent.String
		}
		row.IsShareFolder = isShare
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *FolderRepo) StatsByUser(userID string) (map[string]domain.FolderStat, error) {
	rows, err := r.store.DB.Query(`SELECT id, parent_id FROM folders WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	children := make(map[string][]string)
	allIDs := []string{}
	for rows.Next() {
		var id string
		var parent sql.NullString
		if err := rows.Scan(&id, &parent); err != nil {
			return nil, err
		}
		allIDs = append(allIDs, id)
		if parent.Valid {
			children[parent.String] = append(children[parent.String], id)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	direct := make(map[string]domain.FolderStat)
	imgRows, err := r.store.DB.Query(
		`SELECT folder_id, COUNT(*), COALESCE(SUM(size), 0) FROM images WHERE user_id = $1 AND deleted_at IS NULL AND folder_id IS NOT NULL GROUP BY folder_id`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer imgRows.Close()
	for imgRows.Next() {
		var folderID string
		var st domain.FolderStat
		if err := imgRows.Scan(&folderID, &st.ImageCount, &st.TotalSize); err != nil {
			return nil, err
		}
		direct[folderID] = st
	}
	if err := imgRows.Err(); err != nil {
		return nil, err
	}

	memo := make(map[string]domain.FolderStat)
	var aggregate func(id string) domain.FolderStat
	aggregate = func(id string) domain.FolderStat {
		if st, ok := memo[id]; ok {
			return st
		}
		st := direct[id]
		for _, child := range children[id] {
			c := aggregate(child)
			st.ImageCount += c.ImageCount
			st.TotalSize += c.TotalSize
		}
		memo[id] = st
		return st
	}
	out := make(map[string]domain.FolderStat, len(allIDs))
	for _, id := range allIDs {
		out[id] = aggregate(id)
	}
	return out, nil
}

type folderScanner interface {
	Scan(dest ...any) error
}

func scanFolderRow(row folderScanner) (domain.Folder, error) {
	var f domain.Folder
	var parent sql.NullString
	if err := row.Scan(&f.ID, &parent, &f.Name, &f.IsShareFolder, &f.CreatedAt, &f.UpdatedAt); err != nil {
		return f, err
	}
	if parent.Valid {
		f.ParentID = &parent.String
	}
	return f, nil
}
