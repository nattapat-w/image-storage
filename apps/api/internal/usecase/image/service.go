package imageuc

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"image-storage/apps/api/internal/domain"
	"image-storage/apps/api/internal/port"
)

type Service struct {
	Images    port.ImageRepository
	Folders   port.FolderRepository
	Store     port.BlobStore
	CDN port.ImageCDN
	Meta      port.ImageMetadata
	MaxUpload int64
}

func (s *Service) List(filter domain.ImageListFilter) ([]domain.Image, error) {
	return s.Images.List(filter)
}

func (s *Service) Timeline(userID string) ([]domain.TimelineGroup, error) {
	images, err := s.Images.List(domain.ImageListFilter{UserID: userID, Sort: "timeline"})
	if err != nil {
		return nil, err
	}
	groups := []domain.TimelineGroup{}
	var current *domain.TimelineGroup
	for _, img := range images {
		period := timelinePeriod(img)
		if current == nil || current.Period != period {
			groups = append(groups, domain.TimelineGroup{
				Period: period, Label: timelineLabel(period), Images: []domain.Image{},
			})
			current = &groups[len(groups)-1]
		}
		current.Images = append(current.Images, img)
	}
	return groups, nil
}

func (s *Service) Get(userID, id string) (domain.Image, error) {
	return s.Images.GetOwned(userID, id)
}

func (s *Service) Upload(userID string, folderID string, filename string, mime string, data []byte) (domain.Image, error) {
	if int64(len(data)) > s.MaxUpload {
		return domain.Image{}, &domain.InputError{
			Message: fmt.Sprintf("file exceeds maximum upload size (%s)", formatUploadLimit(s.MaxUpload)),
		}
	}
	mime = normalizeImageMIME(mime)
	if mime == "" || !domain.AllowedMimes[mime] {
		mime = normalizeImageMIME(http.DetectContentType(data))
	}
	if !domain.AllowedMimes[mime] {
		return domain.Image{}, &domain.InputError{
			Message: fmt.Sprintf("unsupported image type (%s); use JPEG, PNG, GIF, or WebP", mime),
		}
	}
	hash := s.Meta.Hash(data)
	if folderID != "" && !s.Folders.Owns(userID, folderID) {
		return domain.Image{}, &domain.InputError{Message: "folder not found"}
	}
	id := uuid.NewString()
	safeName := sanitizeUploadFilename(filename)
	if safeName == "" {
		safeName = id + extForMime(mime)
	}
	var folderPtr *string
	if folderID != "" {
		folderPtr = &folderID
	}
	inFolder, err := s.Images.ListInFolder(userID, folderPtr)
	if err != nil {
		return domain.Image{}, err
	}
	safeName = uniqueImageName(safeName, nameSetFromImages(inFolder))
	key := s.Store.Key(userID, id, safeName)
	if err := s.Store.Save(key, bytes.NewReader(data)); err != nil {
		return domain.Image{}, fmt.Errorf("save file: %w", err)
	}
	now := time.Now().UTC().Format(time.RFC3339)
	img := domain.Image{
		ID: id, FolderID: folderPtr, Name: safeName, MimeType: mime, Size: int64(len(data)),
		Visibility: domain.VisibilityPrivate, ContentHash: hash, TakenAt: s.Meta.TakenAt(data),
		UploadedBy: userID, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.Images.Insert(userID, img, key); err != nil {
		_ = s.Store.Delete(key)
		return domain.Image{}, fmt.Errorf("save metadata: %w", err)
	}
	return s.Images.GetOwned(userID, id)
}

// UploadAsOwner stores the blob under ownerUserID (drive owner). uploadedByUserID is recorded on the row.
func (s *Service) UploadAsOwner(ownerUserID, uploadedByUserID, folderID string, filename string, mime string, data []byte) (domain.Image, error) {
	if int64(len(data)) > s.MaxUpload {
		return domain.Image{}, &domain.InputError{
			Message: fmt.Sprintf("file exceeds maximum upload size (%s)", formatUploadLimit(s.MaxUpload)),
		}
	}
	mime = normalizeImageMIME(mime)
	if mime == "" || !domain.AllowedMimes[mime] {
		mime = normalizeImageMIME(http.DetectContentType(data))
	}
	if !domain.AllowedMimes[mime] {
		return domain.Image{}, &domain.InputError{
			Message: fmt.Sprintf("unsupported image type (%s); use JPEG, PNG, GIF, or WebP", mime),
		}
	}
	if folderID != "" && !s.Folders.Owns(ownerUserID, folderID) {
		return domain.Image{}, &domain.InputError{Message: "folder not found"}
	}
	hash := s.Meta.Hash(data)
	id := uuid.NewString()
	safeName := sanitizeUploadFilename(filename)
	if safeName == "" {
		safeName = id + extForMime(mime)
	}
	var folderPtr *string
	if folderID != "" {
		folderPtr = &folderID
	}
	inFolder, err := s.Images.ListInFolder(ownerUserID, folderPtr)
	if err != nil {
		return domain.Image{}, err
	}
	safeName = uniqueImageName(safeName, nameSetFromImages(inFolder))
	key := s.Store.Key(ownerUserID, id, safeName)
	if err := s.Store.Save(key, bytes.NewReader(data)); err != nil {
		return domain.Image{}, fmt.Errorf("save file: %w", err)
	}
	now := time.Now().UTC().Format(time.RFC3339)
	uploader := uploadedByUserID
	if uploader == "" {
		uploader = ownerUserID
	}
	img := domain.Image{
		ID: id, FolderID: folderPtr, Name: safeName, MimeType: mime, Size: int64(len(data)),
		Visibility: domain.VisibilityPrivate, ContentHash: hash, TakenAt: s.Meta.TakenAt(data),
		UploadedBy: uploader, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.Images.Insert(ownerUserID, img, key); err != nil {
		_ = s.Store.Delete(key)
		return domain.Image{}, fmt.Errorf("save metadata: %w", err)
	}
	return s.Images.GetOwned(ownerUserID, id)
}

func (s *Service) Copy(userID, imageID, targetFolderID string) (domain.Image, error) {
	if _, err := s.Images.GetOwned(userID, imageID); err != nil {
		return domain.Image{}, err
	}
	meta, err := s.Images.GetFileMeta(imageID)
	if err != nil {
		return domain.Image{}, err
	}
	if meta.Deleted {
		return domain.Image{}, domain.ErrNotFound
	}
	obj, err := s.Store.Open(meta.StorageKey)
	if err != nil {
		return domain.Image{}, err
	}
	defer obj.Body.Close()
	data, err := io.ReadAll(obj.Body)
	if err != nil {
		return domain.Image{}, err
	}
	return s.Upload(userID, targetFolderID, meta.Name, meta.MimeType, data)
}

func (s *Service) Update(userID, id string, upd domain.ImageUpdate) (domain.Image, error) {
	if upd.FolderID != nil && *upd.FolderID != "" && !s.Folders.Owns(userID, *upd.FolderID) {
		return domain.Image{}, domain.ErrForbidden
	}
	if upd.Name != nil {
		n := strings.TrimSpace(*upd.Name)
		if n == "" {
			return domain.Image{}, domain.ErrInvalidInput
		}
		upd.Name = &n
	}
	if upd.Visibility != nil && *upd.Visibility != domain.VisibilityPrivate && *upd.Visibility != domain.VisibilityPublic {
		return domain.Image{}, domain.ErrInvalidInput
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.Images.Update(userID, id, upd, now); err != nil {
		return domain.Image{}, err
	}
	return s.Images.GetOwned(userID, id)
}

func (s *Service) SoftDelete(userID, id string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	return s.Images.SoftDelete(userID, id, now)
}

func (s *Service) Restore(userID, id string) (domain.Image, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.Images.Restore(userID, id, now); err != nil {
		return domain.Image{}, err
	}
	return s.Images.GetOwned(userID, id)
}

func (s *Service) DeletePermanent(userID, id string) error {
	key, err := s.Images.PermanentDelete(userID, id)
	if err != nil {
		return err
	}
	return s.Store.Delete(key)
}

func (s *Service) DeleteAllPermanent(userID string) (int, error) {
	keys, err := s.Images.PurgeAll(userID)
	if err != nil {
		return 0, err
	}
	for _, key := range keys {
		_ = s.Store.Delete(key)
	}
	return len(keys), nil
}

func (s *Service) EmptyTrash(userID string) (int, error) {
	keys, err := s.Images.PurgeTrash(userID)
	if err != nil {
		return 0, err
	}
	for _, key := range keys {
		_ = s.Store.Delete(key)
	}
	return len(keys), nil
}

func (s *Service) FileMeta(id string) (domain.ImageFile, error) {
	meta, err := s.Images.GetFileMeta(id)
	if err != nil {
		return meta, err
	}
	if meta.Deleted {
		return meta, domain.ErrNotFound
	}
	return meta, nil
}

func (s *Service) AccessFile(id string, requesterID string, requireAuth bool) (domain.ImageFile, error) {
	meta, err := s.Images.GetFileMeta(id)
	if err != nil {
		return meta, err
	}
	if meta.Deleted {
		if !requireAuth || requesterID == "" || meta.OwnerID != requesterID {
			return meta, domain.ErrNotFound
		}
		return meta, nil
	}
	if meta.Visibility != domain.VisibilityPublic {
		if !requireAuth || requesterID == "" || meta.OwnerID != requesterID {
			return meta, domain.ErrForbidden
		}
	}
	return meta, nil
}

func (s *Service) OpenFile(meta domain.ImageFile) (port.BlobObject, error) {
	return s.Store.Open(meta.StorageKey)
}

func (s *Service) CDNURL(meta domain.ImageFile, mode string, ttlSec int) (port.CDNURLResult, bool, error) {
	if s.CDN == nil || !s.CDN.Enabled() {
		return port.CDNURLResult{}, false, nil
	}
	if mode == "public" && s.CDN.UsePublicObjectURL() {
		url, err := s.CDN.PublicObjectURL(meta.StorageKey)
		if err != nil {
			return port.CDNURLResult{}, false, err
		}
		return port.CDNURLResult{URL: url}, true, nil
	}
	url, err := s.CDN.SignedURL(meta.StorageKey, ttlSec)
	if err != nil {
		return port.CDNURLResult{}, false, err
	}
	return port.CDNURLResult{URL: url}, true, nil
}

func timelinePeriod(img domain.Image) string {
	src := img.CreatedAt
	if img.TakenAt != nil && *img.TakenAt != "" {
		src = *img.TakenAt
	}
	if len(src) >= 7 {
		return src[:7]
	}
	return "unknown"
}

func timelineLabel(period string) string {
	if period == "unknown" {
		return "Unknown date"
	}
	t, err := time.Parse("2006-01", period)
	if err != nil {
		return period
	}
	return t.Format("January 2006")
}

func normalizeImageMIME(mime string) string {
	switch strings.ToLower(strings.TrimSpace(mime)) {
	case "image/jpg", "image/pjpeg", "image/x-citrix-jpeg":
		return "image/jpeg"
	default:
		return mime
	}
}

func formatUploadLimit(n int64) string {
	const mb = 1 << 20
	if n >= mb && n%mb == 0 {
		return fmt.Sprintf("%d MB", n/mb)
	}
	if n >= mb {
		return fmt.Sprintf("%.1f MB", float64(n)/float64(mb))
	}
	if n >= 1024 {
		return fmt.Sprintf("%d KB", n/1024)
	}
	return fmt.Sprintf("%d bytes", n)
}

func extForMime(mime string) string {
	switch mime {
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	default:
		return ".jpg"
	}
}
