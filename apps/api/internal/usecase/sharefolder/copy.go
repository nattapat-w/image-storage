package sharefolderuc

import (
	"io"

	"image-storage/apps/api/internal/domain"
)

func (s *Service) CopyImage(actorID, imageID, targetFolderID string) (domain.Image, error) {
	if s.ImageUC == nil {
		return domain.Image{}, domain.ErrInvalidInput
	}
	img, err := s.Images.GetByID(imageID)
	if err != nil {
		return domain.Image{}, err
	}
	if img.FolderID == nil {
		return domain.Image{}, domain.ErrForbidden
	}
	rootID, ownerID, ok, err := s.ShareFolders.ResolveShareRoot(*img.FolderID)
	if err != nil || !ok {
		return domain.Image{}, domain.ErrForbidden
	}
	if can, err := s.canAccessShareRoot(actorID, rootID); err != nil || !can {
		return domain.Image{}, domain.ErrForbidden
	}
	if err := s.assertCanWriteFolder(actorID, rootID, targetFolderID); err != nil {
		return domain.Image{}, err
	}
	meta, err := s.Images.GetFileMeta(imageID)
	if err != nil {
		return domain.Image{}, err
	}
	if meta.Deleted {
		return domain.Image{}, domain.ErrNotFound
	}
	obj, err := s.ImageUC.OpenFile(meta)
	if err != nil {
		return domain.Image{}, err
	}
	defer obj.Body.Close()
	data, err := io.ReadAll(obj.Body)
	if err != nil {
		return domain.Image{}, err
	}
	return s.ImageUC.UploadAsOwner(ownerID, actorID, targetFolderID, img.Name, img.MimeType, data)
}
