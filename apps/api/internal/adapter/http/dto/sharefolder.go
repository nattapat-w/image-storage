package dto

import "image-storage/apps/api/internal/domain"

type FolderMember struct {
	ID          string `json:"id"`
	UserID      string `json:"userId"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	Role        string `json:"role"`
	JoinedAt    string `json:"joinedAt"`
}

type FolderInvite struct {
	ID        string  `json:"id"`
	FolderID  string  `json:"folderId"`
	Email     string  `json:"email"`
	Token     string  `json:"token,omitempty"`
	InviteURL string  `json:"inviteUrl"`
	ExpiresAt string  `json:"expiresAt"`
	CreatedAt string  `json:"createdAt"`
	Accepted  bool    `json:"accepted"`
}

type SharedFolderEntry struct {
	Folder     Folder `json:"folder"`
	OwnerID    string `json:"ownerId"`
	OwnerEmail string `json:"ownerEmail,omitempty"`
	Role       string `json:"role"`
}

func FolderMembersFromDomain(in []domain.FolderMember) []FolderMember {
	out := make([]FolderMember, len(in))
	for i, m := range in {
		out[i] = FolderMember{
			ID: m.ID, UserID: m.UserID, Email: m.Email, DisplayName: m.DisplayName,
			Role: m.Role, JoinedAt: m.JoinedAt,
		}
	}
	return out
}

func FolderInviteFromDomain(inv domain.FolderInvite, inviteURL string) FolderInvite {
	return FolderInvite{
		ID: inv.ID, FolderID: inv.FolderID, Email: inv.Email,
		InviteURL: inviteURL, ExpiresAt: inv.ExpiresAt, CreatedAt: inv.CreatedAt,
		Accepted: inv.AcceptedAt != nil,
	}
}

func FolderInvitesFromDomain(in []domain.FolderInvite, inviteURL func(token string) string) []FolderInvite {
	out := make([]FolderInvite, len(in))
	for i, inv := range in {
		out[i] = FolderInviteFromDomain(inv, inviteURL(inv.Token))
	}
	return out
}

func SharedFolderEntryFromDomain(e domain.SharedFolderEntry) SharedFolderEntry {
	return SharedFolderEntry{
		Folder: FolderFromDomain(e.Folder), OwnerID: e.OwnerID,
		OwnerEmail: e.OwnerEmail, Role: e.Role,
	}
}

func SharedFolderEntriesFromDomain(in []domain.SharedFolderEntry) []SharedFolderEntry {
	out := make([]SharedFolderEntry, len(in))
	for i, e := range in {
		out[i] = SharedFolderEntryFromDomain(e)
	}
	return out
}

type IncomingShareFolderInvite struct {
	Invite     FolderInvite `json:"invite"`
	Folder     Folder       `json:"folder"`
	OwnerEmail string       `json:"ownerEmail,omitempty"`
}
