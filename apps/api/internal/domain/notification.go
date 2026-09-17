package domain

const (
	NotificationRefShareFolderInvite = "share_folder_invite"
	NotificationTypeShareFolderInvite = "share_folder_invite"
)

type Notification struct {
	ID        string
	UserID    string
	Type      string
	Title     string
	Body      string
	Href      string
	RefType   string
	RefID     string
	ReadAt    *string
	CreatedAt string
}
