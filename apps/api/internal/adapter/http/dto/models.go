package dto

type User struct {
	ID             string `json:"id"`
	Email          string `json:"email"`
	DisplayName    string `json:"displayName"`
	AutoTagEnabled bool   `json:"autoTagEnabled"`
	CreatedAt      string `json:"createdAt"`
}

type Folder struct {
	ID         string  `json:"id"`
	ParentID   *string `json:"parentId"`
	Name       string  `json:"name"`
	ImageCount int64   `json:"imageCount"`
	TotalSize  int64   `json:"totalSize"`
	CreatedAt  string  `json:"createdAt"`
	UpdatedAt  string  `json:"updatedAt"`
}

type FolderOption struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Path       string `json:"path"`
	ImageCount int64  `json:"imageCount"`
	TotalSize  int64  `json:"totalSize"`
}

type Image struct {
	ID          string   `json:"id"`
	FolderID    *string  `json:"folderId"`
	Name        string   `json:"name"`
	MimeType    string   `json:"mimeType"`
	Size        int64    `json:"size"`
	Visibility  string   `json:"visibility"`
	Favorite    bool     `json:"favorite"`
	ContentHash string   `json:"contentHash,omitempty"`
	TakenAt     *string  `json:"takenAt"`
	DeletedAt   *string  `json:"deletedAt,omitempty"`
	Tags        []string `json:"tags"`
	CreatedAt   string   `json:"createdAt"`
	UpdatedAt   string   `json:"updatedAt"`
}

type Tag struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	ImageCount int64  `json:"imageCount"`
}

type TimelineGroup struct {
	Period string  `json:"period"`
	Label  string  `json:"label"`
	Images []Image `json:"images"`
}

type Share struct {
	ID           string `json:"id"`
	ResourceType string `json:"resourceType"`
	ResourceID   string `json:"resourceId"`
	Token        string `json:"token"`
	URL          string `json:"url"`
	CreatedAt    string `json:"createdAt"`
}

type Breadcrumb struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
