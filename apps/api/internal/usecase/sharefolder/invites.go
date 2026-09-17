package sharefolderuc

import (
	"strings"
	"time"

	"image-storage/apps/api/internal/domain"
)

type IncomingInvite struct {
	Invite     domain.FolderInvite
	Folder     domain.Folder
	OwnerEmail string
}

func (s *Service) ListIncomingInvites(userID string) ([]IncomingInvite, error) {
	u, err := s.Users.FindByID(userID)
	if err != nil {
		return nil, err
	}
	invites, err := s.ShareFolders.ListPendingInvitesForEmail(u.Email)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	out := make([]IncomingInvite, 0, len(invites))
	for _, inv := range invites {
		if inv.AcceptedAt != nil {
			continue
		}
		if now.After(mustParse(inv.ExpiresAt)) {
			continue
		}
		ownerID, err := s.ShareFolders.GetFolderOwner(inv.FolderID)
		if err != nil {
			continue
		}
		f, err := s.Folders.Get(ownerID, inv.FolderID)
		if err != nil {
			continue
		}
		ownerEmail := ""
		if owner, err := s.Users.FindByID(ownerID); err == nil {
			ownerEmail = owner.Email
		}
		out = append(out, IncomingInvite{Invite: inv, Folder: f, OwnerEmail: ownerEmail})
	}
	return out, nil
}

func (s *Service) ListFolderTree(userID, rootFolderID string) ([]domain.FolderOption, error) {
	if ok, err := s.canAccessShareRoot(userID, rootFolderID); err != nil || !ok {
		if err != nil {
			return nil, err
		}
		return nil, domain.ErrForbidden
	}
	ownerID, err := s.ShareFolders.GetFolderOwner(rootFolderID)
	if err != nil {
		return nil, err
	}
	items, err := s.Folders.ListRows(ownerID)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]domain.FolderRow, len(items))
	for _, item := range items {
		byID[item.ID] = item
	}
	inTree := subtreeIDs(rootFolderID, byID)
	pathFor := func(id string) string {
		var parts []string
		seen := make(map[string]bool)
		cur := id
		for cur != "" {
			if seen[cur] {
				break
			}
			seen[cur] = true
			item, ok := byID[cur]
			if !ok {
				break
			}
			parts = append([]string{item.Name}, parts...)
			if item.ParentID == nil {
				break
			}
			cur = *item.ParentID
		}
		return strings.Join(parts, " / ")
	}
	stats, _ := s.Folders.StatsByUser(ownerID)
	out := make([]domain.FolderOption, 0, len(inTree))
	for id := range inTree {
		item, ok := byID[id]
		if !ok {
			continue
		}
		opt := domain.FolderOption{
			ID: item.ID, Name: item.Name, Path: pathFor(item.ID), IsShareFolder: item.IsShareFolder,
		}
		if st, ok := stats[item.ID]; ok {
			opt.ImageCount = st.ImageCount
			opt.TotalSize = st.TotalSize
		}
		out = append(out, opt)
	}
	return out, nil
}

func subtreeIDs(rootID string, byID map[string]domain.FolderRow) map[string]bool {
	byParent := make(map[string][]string)
	for id, row := range byID {
		parent := ""
		if row.ParentID != nil {
			parent = *row.ParentID
		}
		byParent[parent] = append(byParent[parent], id)
	}
	set := map[string]bool{rootID: true}
	var walk func(string)
	walk = func(pid string) {
		for _, child := range byParent[pid] {
			set[child] = true
			walk(child)
		}
	}
	walk(rootID)
	return set
}
