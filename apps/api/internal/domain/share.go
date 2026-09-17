package domain

const (
	ResourceImage  = "image"
	ResourceFolder = "folder"
)

type Share struct {
	ID           string
	UserID       string
	ResourceType string
	ResourceID   string
	Token        string
	ExpiresAt    *string
	CreatedAt    string
}

type ShareView struct {
	Type    string
	Image   *Image
	Folders []Folder
	Images  []Image
}
