package sharefolderuc

import (
	"strings"
	"time"

	"github.com/google/uuid"

	"image-storage/apps/api/internal/domain"
)

func (s *Service) UploadImage(actorID, rootFolderID, targetFolderID string, filename, mime string, data []byte) (domain.Image, error) {
	if s.ImageUC == nil {
		return domain.Image{}, domain.ErrInvalidInput
	}
	if err := s.assertCanWriteFolder(actorID, rootFolderID, targetFolderID); err != nil {
		return domain.Image{}, err
	}
	ownerID, err := s.ShareFolders.GetFolderOwner(rootFolderID)
	if err != nil {
		return domain.Image{}, err
	}
	return s.ImageUC.UploadAsOwner(ownerID, actorID, targetFolderID, filename, mime, data)
}

func (s *Service) CreateSubfolder(actorID, rootFolderID, parentFolderID, name string) (domain.Folder, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return domain.Folder{}, domain.ErrInvalidInput
	}
	if err := s.assertCanWriteFolder(actorID, rootFolderID, parentFolderID); err != nil {
		return domain.Folder{}, err
	}
	ownerID, err := s.ShareFolders.GetFolderOwner(rootFolderID)
	if err != nil {
		return domain.Folder{}, err
	}
	id := uuid.NewString()
	now := time.Now().UTC().Format(time.RFC3339)
	parent := parentFolderID
	f := domain.Folder{ID: id, ParentID: &parent, Name: name, CreatedAt: now, UpdatedAt: now}
	if err := s.Folders.Create(ownerID, f); err != nil {
		return domain.Folder{}, err
	}
	return s.Folders.Get(ownerID, id)
}

func (s *Service) DeleteImage(actorID, imageID string) error {
	img, err := s.Images.GetByID(imageID)
	if err != nil {
		return err
	}
	if img.FolderID == nil {
		return domain.ErrForbidden
	}
	rootID, ownerID, ok, err := s.ShareFolders.ResolveShareRoot(*img.FolderID)
	if err != nil || !ok {
		return domain.ErrForbidden
	}
	if can, err := s.canAccessShareRoot(actorID, rootID); err != nil || !can {
		return domain.ErrForbidden
	}
	uploader := img.UploadedBy
	if uploader == "" {
		uploader = ownerID
	}
	if actorID != ownerID && uploader != actorID {
		return domain.ErrForbidden
	}
	now := time.Now().UTC().Format(time.RFC3339)
	return s.Images.SoftDelete(ownerID, imageID, now)
}

func (s *Service) AccessImageFile(actorID, imageID string) (domain.ImageFile, error) {
	img, err := s.Images.GetByID(imageID)
	if err != nil {
		return domain.ImageFile{}, err
	}
	if img.FolderID == nil {
		return domain.ImageFile{}, domain.ErrForbidden
	}
	rootID, _, ok, err := s.ShareFolders.ResolveShareRoot(*img.FolderID)
	if err != nil || !ok {
		return domain.ImageFile{}, domain.ErrForbidden
	}
	if can, err := s.canAccessShareRoot(actorID, rootID); err != nil || !can {
		return domain.ImageFile{}, domain.ErrForbidden
	}
	meta, err := s.Images.GetFileMeta(imageID)
	if err != nil {
		return meta, err
	}
	if meta.Deleted {
		return meta, domain.ErrNotFound
	}
	return meta, nil
}

func (s *Service) assertCanWriteFolder(actorID, rootFolderID, targetFolderID string) error {
	if ok, err := s.canAccessShareRoot(actorID, rootFolderID); err != nil || !ok {
		if err != nil {
			return err
		}
		return domain.ErrForbidden
	}
	inTree, err := s.ShareFolders.IsFolderInTree(targetFolderID, rootFolderID)
	if err != nil {
		return err
	}
	if !inTree {
		return domain.ErrForbidden
	}
	return nil
}
