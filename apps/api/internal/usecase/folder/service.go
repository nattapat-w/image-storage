package folderuc

import (
	"strings"
	"time"

	"github.com/google/uuid"

	"image-storage/apps/api/internal/domain"
	"image-storage/apps/api/internal/port"
)

type Service struct {
	Folders port.FolderRepository
}

func (s *Service) List(userID string, parentID *string) ([]domain.Folder, error) {
	return s.Folders.ListChildren(userID, parentID)
}

func (s *Service) Create(userID, name string, parentID *string) (domain.Folder, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return domain.Folder{}, domain.ErrInvalidInput
	}
	if parentID != nil && *parentID != "" {
		if !s.Folders.Owns(userID, *parentID) {
			return domain.Folder{}, domain.ErrForbidden
		}
		if err := s.ensureCreateDepthOK(userID, *parentID); err != nil {
			return domain.Folder{}, err
		}
	} else {
		parentID = nil
	}
	id := uuid.NewString()
	now := time.Now().UTC().Format(time.RFC3339)
	f := domain.Folder{ID: id, ParentID: parentID, Name: name, CreatedAt: now, UpdatedAt: now}
	if err := s.Folders.Create(userID, f); err != nil {
		return domain.Folder{}, err
	}
	return f, nil
}

func (s *Service) Update(userID, id string, name *string, parentID *string, updateParent bool) (domain.Folder, error) {
	if !s.Folders.Owns(userID, id) {
		return domain.Folder{}, domain.ErrNotFound
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if name != nil {
		n := strings.TrimSpace(*name)
		if n == "" {
			return domain.Folder{}, domain.ErrInvalidInput
		}
		if err := s.Folders.UpdateName(userID, id, n, now); err != nil {
			return domain.Folder{}, err
		}
	}
	if updateParent {
		if parentID != nil && *parentID == id {
			return domain.Folder{}, domain.ErrInvalidInput
		}
		if parentID != nil && *parentID != "" {
			if !s.Folders.Owns(userID, *parentID) {
				return domain.Folder{}, domain.ErrForbidden
			}
			if s.isDescendant(userID, *parentID, id) {
				return domain.Folder{}, domain.ErrInvalidInput
			}
		}
		var p *string
		if parentID != nil && *parentID != "" {
			p = parentID
		}
		if err := s.ensureMoveDepthOK(userID, id, p); err != nil {
			return domain.Folder{}, err
		}
		if err := s.Folders.UpdateParent(userID, id, p, now); err != nil {
			return domain.Folder{}, err
		}
	}
	return s.Folders.Get(userID, id)
}

func (s *Service) ensureCreateDepthOK(userID, parentID string) error {
	parentDepth, err := s.folderDepth(userID, parentID)
	if err != nil {
		return err
	}
	if parentDepth+1 > domain.MaxFolderNesting {
		return &domain.InputError{Message: domain.FolderNestingLimitMessage}
	}
	return nil
}

func (s *Service) ensureMoveDepthOK(userID, folderID string, newParentID *string) error {
	rows, err := s.Folders.ListRows(userID)
	if err != nil {
		return err
	}
	byID := make(map[string]domain.FolderRow, len(rows))
	for _, row := range rows {
		byID[row.ID] = row
	}
	baseDepth := 0
	if newParentID != nil && *newParentID != "" {
		d, err := s.folderDepth(userID, *newParentID)
		if err != nil {
			return err
		}
		baseDepth = d
	}
	span := subtreeDepthSpan(folderID, byID)
	if baseDepth+span > domain.MaxFolderNesting {
		return &domain.InputError{Message: domain.FolderNestingLimitMessage}
	}
	return nil
}

func (s *Service) folderDepth(userID, folderID string) (int, error) {
	depth := 0
	current := folderID
	seen := make(map[string]bool)
	for current != "" {
		if seen[current] {
			return 0, domain.ErrInvalidInput
		}
		seen[current] = true
		depth++
		f, err := s.Folders.Get(userID, current)
		if err != nil {
			return 0, err
		}
		if f.ParentID == nil || *f.ParentID == "" {
			break
		}
		current = *f.ParentID
	}
	return depth, nil
}

func subtreeDepthSpan(rootID string, byID map[string]domain.FolderRow) int {
	byParent := make(map[string][]string)
	for id, row := range byID {
		parent := ""
		if row.ParentID != nil {
			parent = *row.ParentID
		}
		byParent[parent] = append(byParent[parent], id)
	}
	var walk func(id string) int
	walk = func(id string) int {
		children := byParent[id]
		if len(children) == 0 {
			return 1
		}
		best := 0
		for _, child := range children {
			if d := walk(child); d > best {
				best = d
			}
		}
		return 1 + best
	}
	return walk(rootID)
}

func (s *Service) isDescendant(userID, folderID, ancestorID string) bool {
	current := folderID
	for current != "" {
		if current == ancestorID {
			return true
		}
		f, err := s.Folders.Get(userID, current)
		if err != nil {
			return false
		}
		if f.ParentID == nil {
			return false
		}
		current = *f.ParentID
	}
	return false
}

func (s *Service) Delete(userID, id string) error {
	if !s.Folders.Owns(userID, id) {
		return domain.ErrNotFound
	}
	return s.Folders.Delete(userID, id)
}

func (s *Service) PurgeAll(userID string) (int, error) {
	return s.Folders.PurgeAll(userID)
}

func (s *Service) Breadcrumb(userID, folderID string) ([]domain.Breadcrumb, error) {
	if folderID == "" {
		return []domain.Breadcrumb{}, nil
	}
	return s.Folders.Breadcrumb(userID, folderID)
}

func (s *Service) ListAll(userID string) ([]domain.FolderOption, error) {
	items, err := s.Folders.ListRows(userID)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]domain.FolderRow, len(items))
	for _, item := range items {
		byID[item.ID] = item
	}
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
	stats, _ := s.Folders.StatsByUser(userID)
	out := make([]domain.FolderOption, 0, len(items))
	for _, item := range items {
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
