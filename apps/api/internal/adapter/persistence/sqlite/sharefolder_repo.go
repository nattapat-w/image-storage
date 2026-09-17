package sqlite

import (
	"database/sql"
	"strings"

	"image-storage/apps/api/internal/domain"
)

type ShareFolderRepo struct {
	store *Store
}

func (r *ShareFolderRepo) SetSharingEnabled(ownerID, folderID string, enabled bool, updatedAt string) error {
	en := 0
	if enabled {
		en = 1
	}
	res, err := r.store.DB.Exec(
		`UPDATE folders SET is_share_folder = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
		en, updatedAt, folderID, ownerID,
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

func (r *ShareFolderRepo) IsSharingRoot(folderID string) (bool, error) {
	var isShare int
	err := r.store.DB.QueryRow(`SELECT is_share_folder FROM folders WHERE id = ?`, folderID).Scan(&isShare)
	if err == sql.ErrNoRows {
		return false, domain.ErrNotFound
	}
	return isShare != 0, err
}

func (r *ShareFolderRepo) GetFolderOwner(folderID string) (string, error) {
	var owner string
	err := r.store.DB.QueryRow(`SELECT user_id FROM folders WHERE id = ?`, folderID).Scan(&owner)
	if err == sql.ErrNoRows {
		return "", domain.ErrNotFound
	}
	return owner, err
}

func (r *ShareFolderRepo) IsFolderInTree(folderID, rootID string) (bool, error) {
	if folderID == rootID {
		return true, nil
	}
	cur := folderID
	for i := 0; i < 256; i++ {
		var parent sql.NullString
		err := r.store.DB.QueryRow(`SELECT parent_id FROM folders WHERE id = ?`, cur).Scan(&parent)
		if err == sql.ErrNoRows {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		if !parent.Valid {
			return false, nil
		}
		if parent.String == rootID {
			return true, nil
		}
		cur = parent.String
	}
	return false, nil
}

func (r *ShareFolderRepo) ResolveShareRoot(folderID string) (rootID, ownerID string, ok bool, err error) {
	cur := folderID
	for i := 0; i < 256; i++ {
		var parent sql.NullString
		var isShare int
		err := r.store.DB.QueryRow(
			`SELECT parent_id, is_share_folder, user_id FROM folders WHERE id = ?`, cur,
		).Scan(&parent, &isShare, &ownerID)
		if err == sql.ErrNoRows {
			return "", "", false, nil
		}
		if err != nil {
			return "", "", false, err
		}
		if isShare != 0 {
			return cur, ownerID, true, nil
		}
		if !parent.Valid {
			return "", "", false, nil
		}
		cur = parent.String
	}
	return "", "", false, nil
}

func (r *ShareFolderRepo) ListMembers(ownerID, folderID string) ([]domain.FolderMember, error) {
	if err := r.assertSharingRootOwned(ownerID, folderID); err != nil {
		return nil, err
	}
	rows, err := r.store.DB.Query(`
SELECT fm.id, fm.folder_id, fm.user_id, fm.role, COALESCE(fm.invited_by, ''), fm.joined_at,
       u.email, COALESCE(u.display_name, '')
FROM folder_members fm
JOIN users u ON u.id = fm.user_id
WHERE fm.folder_id = ?
ORDER BY fm.joined_at`, folderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.FolderMember{}
	for rows.Next() {
		var m domain.FolderMember
		if err := rows.Scan(&m.ID, &m.FolderID, &m.UserID, &m.Role, &m.InvitedBy, &m.JoinedAt, &m.Email, &m.DisplayName); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *ShareFolderRepo) AddMember(id, folderID, userID, role, invitedBy, joinedAt string) error {
	var invBy any
	if invitedBy != "" {
		invBy = invitedBy
	}
	_, err := r.store.DB.Exec(
		`INSERT OR IGNORE INTO folder_members (id, folder_id, user_id, role, invited_by, joined_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id, folderID, userID, role, invBy, joinedAt,
	)
	return err
}

func (r *ShareFolderRepo) RemoveMember(folderID, userID string) error {
	res, err := r.store.DB.Exec(`DELETE FROM folder_members WHERE folder_id = ? AND user_id = ?`, folderID, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *ShareFolderRepo) IsMember(folderID, userID string) (bool, error) {
	var n int
	err := r.store.DB.QueryRow(
		`SELECT 1 FROM folder_members WHERE folder_id = ? AND user_id = ?`, folderID, userID,
	).Scan(&n)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

func (r *ShareFolderRepo) ListSharedFoldersForUser(userID string) ([]domain.SharedFolderEntry, error) {
	rows, err := r.store.DB.Query(`
SELECT f.id, f.parent_id, f.name, f.is_share_folder, f.created_at, f.updated_at, f.user_id, fm.role, u.email
FROM folder_members fm
JOIN folders f ON f.id = fm.folder_id
JOIN users u ON u.id = f.user_id
WHERE fm.user_id = ? AND f.is_share_folder = 1
ORDER BY f.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.SharedFolderEntry{}
	for rows.Next() {
		var e domain.SharedFolderEntry
		var parent sql.NullString
		var isShare int
		if err := rows.Scan(
			&e.Folder.ID, &parent, &e.Folder.Name, &isShare,
			&e.Folder.CreatedAt, &e.Folder.UpdatedAt, &e.OwnerID, &e.Role, &e.OwnerEmail,
		); err != nil {
			return nil, err
		}
		e.Folder.IsShareFolder = isShare != 0
		if parent.Valid {
			e.Folder.ParentID = &parent.String
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *ShareFolderRepo) CreateInvite(inv domain.FolderInvite) error {
	_, err := r.store.DB.Exec(
		`INSERT INTO folder_invites (id, folder_id, email, token, invited_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		inv.ID, inv.FolderID, strings.ToLower(strings.TrimSpace(inv.Email)), inv.Token, inv.InvitedBy, inv.ExpiresAt, inv.CreatedAt,
	)
	return err
}

func (r *ShareFolderRepo) ListPendingInvitesForEmail(email string) ([]domain.FolderInvite, error) {
	rows, err := r.store.DB.Query(`
SELECT id, folder_id, email, token, invited_by, expires_at, accepted_at, created_at
FROM folder_invites
WHERE LOWER(email) = LOWER(?) AND accepted_at IS NULL
ORDER BY created_at DESC`, strings.TrimSpace(email))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanInvites(rows)
}

func (r *ShareFolderRepo) ListPendingInvites(ownerID, folderID string) ([]domain.FolderInvite, error) {
	if err := r.assertSharingRootOwned(ownerID, folderID); err != nil {
		return nil, err
	}
	rows, err := r.store.DB.Query(`
SELECT id, folder_id, email, token, invited_by, expires_at, accepted_at, created_at
FROM folder_invites
WHERE folder_id = ? AND accepted_at IS NULL
ORDER BY created_at DESC`, folderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanInvites(rows)
}

func (r *ShareFolderRepo) FindInviteByToken(token string) (domain.FolderInvite, error) {
	row := r.store.DB.QueryRow(`
SELECT id, folder_id, email, token, invited_by, expires_at, accepted_at, created_at
FROM folder_invites WHERE token = ?`, token)
	return scanInviteRow(row)
}

func (r *ShareFolderRepo) MarkInviteAccepted(inviteID, acceptedAt string) error {
	res, err := r.store.DB.Exec(`UPDATE folder_invites SET accepted_at = ? WHERE id = ? AND accepted_at IS NULL`, acceptedAt, inviteID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *ShareFolderRepo) DeleteInvite(ownerID, inviteID string) error {
	res, err := r.store.DB.Exec(`
DELETE FROM folder_invites
WHERE id = ? AND folder_id IN (SELECT id FROM folders WHERE user_id = ?)`, inviteID, ownerID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *ShareFolderRepo) ClearSharingData(folderID string) error {
	if _, err := r.store.DB.Exec(`DELETE FROM folder_members WHERE folder_id = ?`, folderID); err != nil {
		return err
	}
	_, err := r.store.DB.Exec(`DELETE FROM folder_invites WHERE folder_id = ?`, folderID)
	return err
}

func (r *ShareFolderRepo) assertSharingRootOwned(ownerID, folderID string) error {
	var uid string
	var isShare int
	err := r.store.DB.QueryRow(`SELECT user_id, is_share_folder FROM folders WHERE id = ?`, folderID).Scan(&uid, &isShare)
	if err == sql.ErrNoRows {
		return domain.ErrNotFound
	}
	if err != nil {
		return err
	}
	if uid != ownerID || isShare == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func scanInviteRow(row *sql.Row) (domain.FolderInvite, error) {
	var inv domain.FolderInvite
	var accepted sql.NullString
	err := row.Scan(&inv.ID, &inv.FolderID, &inv.Email, &inv.Token, &inv.InvitedBy, &inv.ExpiresAt, &accepted, &inv.CreatedAt)
	if err == sql.ErrNoRows {
		return inv, domain.ErrNotFound
	}
	if accepted.Valid {
		inv.AcceptedAt = &accepted.String
	}
	return inv, err
}

func scanInvites(rows *sql.Rows) ([]domain.FolderInvite, error) {
	out := []domain.FolderInvite{}
	for rows.Next() {
		var inv domain.FolderInvite
		var accepted sql.NullString
		if err := rows.Scan(&inv.ID, &inv.FolderID, &inv.Email, &inv.Token, &inv.InvitedBy, &inv.ExpiresAt, &accepted, &inv.CreatedAt); err != nil {
			return nil, err
		}
		if accepted.Valid {
			inv.AcceptedAt = &accepted.String
		}
		out = append(out, inv)
	}
	return out, rows.Err()
}
