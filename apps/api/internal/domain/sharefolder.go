package domain

const (
	FolderMemberRoleMember = "member"
	FolderMemberRoleOwner  = "owner"
)

type FolderMember struct {
	ID          string
	FolderID    string
	UserID      string
	Role        string
	InvitedBy   string
	JoinedAt    string
	Email       string
	DisplayName string
}

type FolderInvite struct {
	ID         string
	FolderID   string
	Email      string
	Token      string
	InvitedBy  string
	ExpiresAt  string
	AcceptedAt *string
	CreatedAt  string
}

type SharedFolderEntry struct {
	Folder     Folder
	OwnerID    string
	OwnerEmail string
	Role       string
}

type ShareFolderBrowse struct {
	Folders []Folder
	Images  []Image
	RootID  string
	OwnerID string
}
