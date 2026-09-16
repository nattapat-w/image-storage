package port

import "image-storage/apps/api/internal/domain"

type UserRepository interface {
	Create(user domain.User, passwordHash, createdAt string) error
	FindByEmail(email string) (domain.User, string, error)
	FindByID(id string) (domain.User, error)
	UpdateProfile(id, email, displayName, updatedAt string) error
	UpdateAutoTagEnabled(id string, enabled bool, updatedAt string) error
	UpdatePassword(id, passwordHash, updatedAt string) error
	Delete(id string) error
}

type PasswordResetRepository interface {
	Create(userID, tokenHash, expiresAt, createdAt string) error
	FindUserIDByTokenHash(tokenHash string, now string) (string, error)
	DeleteByUser(userID string) error
	DeleteToken(tokenHash string) error
}

type FolderRepository interface {
	ListChildren(userID string, parentID *string) ([]domain.Folder, error)
	Create(userID string, folder domain.Folder) error
	Get(userID, id string) (domain.Folder, error)
	UpdateName(userID, id, name, updatedAt string) error
	UpdateParent(userID, id string, parentID *string, updatedAt string) error
	Delete(userID, id string) error
	PurgeAll(userID string) (int, error)
	Owns(userID, id string) bool
	Breadcrumb(userID, folderID string) ([]domain.Breadcrumb, error)
	ListRows(userID string) ([]domain.FolderRow, error)
	StatsByUser(userID string) (map[string]domain.FolderStat, error)
}

type ImageRepository interface {
	List(filter domain.ImageListFilter) ([]domain.Image, error)
	GetOwned(userID, id string) (domain.Image, error)
	GetByID(id string) (domain.Image, error)
	FindActiveByHash(userID, hash string) (string, error)
	GetFileMeta(id string) (domain.ImageFile, error)
	Insert(userID string, img domain.Image, storageKey string) error
	Update(userID, id string, upd domain.ImageUpdate, updatedAt string) error
	SoftDelete(userID, id, deletedAt string) error
	Restore(userID, id, updatedAt string) error
	PurgeAll(userID string) ([]string, error)
	PurgeTrash(userID string) ([]string, error)
	PermanentDelete(userID, id string) (string, error)
	IsOwned(userID, id string) bool
	IsInFolderTree(imageID, rootFolderID string) bool
	ListInFolder(userID string, folderID *string) ([]domain.Image, error)
}

type TagRepository interface {
	ListByUser(userID string) ([]domain.Tag, error)
	SetImageTags(userID, imageID string, tagNames []string, now string) error
}

type ShareRepository interface {
	Create(share domain.Share) error
	ListByResource(userID, resourceType, resourceID string) ([]domain.Share, error)
	Delete(userID, id string) error
	FindByToken(token string) (domain.Share, error)
	OwnsResource(userID, typ, id string) bool
}
