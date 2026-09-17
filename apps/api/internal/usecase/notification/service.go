package notificationuc

import (
	"strings"
	"time"

	"github.com/google/uuid"

	"image-storage/apps/api/internal/domain"
	"image-storage/apps/api/internal/port"
)

type Service struct {
	Notifications port.NotificationRepository
	ShareFolders  port.ShareFolderRepository
	Folders       port.FolderRepository
	Users         port.UserRepository
	FrontendURL   string
}

func (s *Service) List(userID string) ([]domain.Notification, error) {
	if err := s.syncShareInvites(userID); err != nil {
		return nil, err
	}
	return s.Notifications.ListForUser(userID, 100)
}

func (s *Service) MarkRead(userID, id string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	return s.Notifications.MarkRead(userID, id, now)
}

func (s *Service) MarkAllRead(userID string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	return s.Notifications.MarkAllRead(userID, now)
}

func (s *Service) EnsureShareInviteNotification(inv domain.FolderInvite) error {
	u, _, err := s.Users.FindByEmail(inv.Email)
	if err != nil {
		return nil
	}
	ownerID, err := s.ShareFolders.GetFolderOwner(inv.FolderID)
	if err != nil {
		return err
	}
	f, err := s.Folders.Get(ownerID, inv.FolderID)
	if err != nil {
		return err
	}
	inviterEmail := ""
	if inviter, err := s.Users.FindByID(inv.InvitedBy); err == nil {
		inviterEmail = inviter.Email
	}
	return s.NotifyShareFolderInvite(u.ID, inv, f, inviterEmail)
}

func (s *Service) NotifyShareFolderInvite(recipientUserID string, inv domain.FolderInvite, folder domain.Folder, inviterEmail string) error {
	href := s.inviteHref(inv.Token)
	body := "Collaborate on this shared folder"
	if inviterEmail != "" {
		body = "From " + inviterEmail
	}
	now := time.Now().UTC().Format(time.RFC3339)
	return s.Notifications.Upsert(domain.Notification{
		ID:        uuid.NewString(),
		UserID:    recipientUserID,
		Type:      domain.NotificationTypeShareFolderInvite,
		Title:     "Invite to " + folder.Name,
		Body:      body,
		Href:      href,
		RefType:   domain.NotificationRefShareFolderInvite,
		RefID:     inv.ID,
		CreatedAt: now,
	})
}

func (s *Service) MarkShareInviteRead(userID, inviteID string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	return s.Notifications.MarkReadByRef(userID, domain.NotificationRefShareFolderInvite, inviteID, now)
}

func (s *Service) syncShareInvites(userID string) error {
	u, err := s.Users.FindByID(userID)
	if err != nil {
		return err
	}
	invites, err := s.ShareFolders.ListPendingInvitesForEmail(u.Email)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	for _, inv := range invites {
		if inv.AcceptedAt != nil {
			continue
		}
		if now.After(mustParse(inv.ExpiresAt)) {
			continue
		}
		ownerID, err := s.ShareFolders.GetFolderOwner(inv.FolderID)
		if err != nil {
			continue
		}
		f, err := s.Folders.Get(ownerID, inv.FolderID)
		if err != nil {
			continue
		}
		inviterEmail := ""
		if inviter, err := s.Users.FindByID(inv.InvitedBy); err == nil {
			inviterEmail = inviter.Email
		}
		if err := s.NotifyShareFolderInvite(userID, inv, f, inviterEmail); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) inviteHref(token string) string {
	base := strings.TrimRight(s.FrontendURL, "/")
	return base + "/invite/share-folder/" + token
}

func mustParse(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}
	}
	return t
}
