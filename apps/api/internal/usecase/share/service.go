package shareuc

import (
	"crypto/rand"
	"encoding/base64"
	"time"

	"github.com/google/uuid"

	"image-storage/apps/api/internal/domain"
	"image-storage/apps/api/internal/port"
)

type Service struct {
	Shares  port.ShareRepository
	Images  port.ImageRepository
	Folders port.FolderRepository
	Store   port.BlobStore
}

func (s *Service) Create(userID, resourceType, resourceID string) (domain.Share, error) {
	if resourceType != domain.ResourceImage && resourceType != domain.ResourceFolder {
		return domain.Share{}, domain.ErrInvalidInput
	}
	if !s.Shares.OwnsResource(userID, resourceType, resourceID) {
		return domain.Share{}, domain.ErrNotFound
	}
	token, err := randomToken()
	if err != nil {
		return domain.Share{}, err
	}
	id := uuid.NewString()
	now := time.Now().UTC().Format(time.RFC3339)
	share := domain.Share{
		ID: id, UserID: userID, ResourceType: resourceType,
		ResourceID: resourceID, Token: token, CreatedAt: now,
	}
	if err := s.Shares.Create(share); err != nil {
		return domain.Share{}, err
	}
	return share, nil
}

func (s *Service) List(userID, resourceType, resourceID string) ([]domain.Share, error) {
	return s.Shares.ListByResource(userID, resourceType, resourceID)
}

func (s *Service) Delete(userID, id string) error {
	return s.Shares.Delete(userID, id)
}

func (s *Service) ViewByToken(token string) (domain.ShareView, error) {
	share, err := s.Shares.FindByToken(token)
	if err != nil {
		return domain.ShareView{}, err
	}
	switch share.ResourceType {
	case domain.ResourceImage:
		img, err := s.Images.GetByID(share.ResourceID)
		if err != nil {
			return domain.ShareView{}, err
		}
		return domain.ShareView{Type: domain.ResourceImage, Image: &img}, nil
	case domain.ResourceFolder:
		folders, err := s.Folders.ListChildren(share.UserID, &share.ResourceID)
		if err != nil {
			return domain.ShareView{}, err
		}
		images, err := s.Images.ListInFolder(share.UserID, &share.ResourceID)
		if err != nil {
			return domain.ShareView{}, err
		}
		return domain.ShareView{Type: domain.ResourceFolder, Folders: folders, Images: images}, nil
	default:
		return domain.ShareView{}, domain.ErrNotFound
	}
}

func (s *Service) CanAccessShareImage(token, imageID string) error {
	share, err := s.Shares.FindByToken(token)
	if err != nil {
		return err
	}
	if share.ResourceType == domain.ResourceImage {
		if share.ResourceID != imageID {
			return domain.ErrForbidden
		}
		return nil
	}
	if share.ResourceType == domain.ResourceFolder {
		if !s.Images.IsInFolderTree(imageID, share.ResourceID) {
			return domain.ErrForbidden
		}
		return nil
	}
	return domain.ErrNotFound
}

func (s *Service) PublicImageFile(id string) (domain.ImageFile, error) {
	meta, err := s.Images.GetFileMeta(id)
	if err != nil {
		return meta, err
	}
	if meta.Deleted || meta.Visibility != domain.VisibilityPublic {
		return meta, domain.ErrNotFound
	}
	return meta, nil
}

func (s *Service) OpenFile(meta domain.ImageFile) (port.BlobObject, error) {
	return s.Store.Open(meta.StorageKey)
}

func randomToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
