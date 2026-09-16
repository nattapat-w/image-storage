package domain

const (
	VisibilityPrivate = "private"
	VisibilityPublic  = "public"
)

var AllowedMimes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/gif":  true,
	"image/webp": true,
}

type Image struct {
	ID          string
	FolderID    *string
	Name        string
	MimeType    string
	Size        int64
	Visibility  string
	Favorite    bool
	ContentHash string
	TakenAt     *string
	DeletedAt   *string
	Tags        []string
	CreatedAt   string
	UpdatedAt   string
}

type ImageFile struct {
	StorageKey string
	MimeType   string
	Name       string
	OwnerID    string
	Visibility string
	Deleted    bool
}

type ImageListFilter struct {
	UserID   string
	FolderID string
	Trash    bool
	Favorite bool
	Tag      string
	Sort     string
}

type TimelineGroup struct {
	Period string
	Label  string
	Images []Image
}

type ImageUpdate struct {
	Name       *string
	FolderID   *string
	Visibility *string
	Favorite   *bool
}
