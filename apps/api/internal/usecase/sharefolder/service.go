package sharefolderuc

import (
	"crypto/rand"
	"encoding/base64"
	"strings"
	"time"

	"github.com/google/uuid"

	"image-storage/apps/api/internal/domain"
	"image-storage/apps/api/internal/port"
	imageuc "image-storage/apps/api/internal/usecase/image"
)

const inviteTTL = 7 * 24 * time.Hour

type Service struct {
	ShareFolders port.ShareFolderRepository
	Folders      port.FolderRepository
	Images       port.ImageRepository
	ImageUC      *imageuc.Service
	Users        port.UserRepository
	FrontendURL  string
}

func (s *Service) EnableSharing(ownerID, folderID string) (domain.Folder, error) {
	if !s.Folders.Owns(ownerID, folderID) {
		return domain.Folder{}, domain.ErrNotFound
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.ShareFolders.SetSharingEnabled(ownerID, folderID, true, now); err != nil {
		return domain.Folder{}, err
	}
	return s.Folders.Get(ownerID, folderID)
}

func (s *Service) DisableSharing(ownerID, folderID string) error {
	if !s.Folders.Owns(ownerID, folderID) {
		return domain.ErrNotFound
	}
	isShare, err := s.ShareFolders.IsSharingRoot(folderID)
	if err != nil {
		return err
	}
	if !isShare {
		return domain.ErrInvalidInput
	}
	if err := s.ShareFolders.ClearSharingData(folderID); err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	return s.ShareFolders.SetSharingEnabled(ownerID, folderID, false, now)
}

func (s *Service) ListMembers(ownerID, folderID string) ([]domain.FolderMember, error) {
	return s.ShareFolders.ListMembers(ownerID, folderID)
}

func (s *Service) InviteByEmail(ownerID, folderID, email string) (domain.FolderInvite, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return domain.FolderInvite{}, domain.ErrInvalidInput
	}
	if _, err := s.ShareFolders.ListMembers(ownerID, folderID); err != nil {
		return domain.FolderInvite{}, err
	}
	token, err := randomToken()
	if err != nil {
		return domain.FolderInvite{}, err
	}
	now := time.Now().UTC()
	inv := domain.FolderInvite{
		ID:        uuid.NewString(),
		FolderID:  folderID,
		Email:     email,
		Token:     token,
		InvitedBy: ownerID,
		ExpiresAt: now.Add(inviteTTL).Format(time.RFC3339),
		CreatedAt: now.Format(time.RFC3339),
	}
	if err := s.ShareFolders.CreateInvite(inv); err != nil {
		return domain.FolderInvite{}, err
	}
	return inv, nil
}

func (s *Service) ListPendingInvites(ownerID, folderID string) ([]domain.FolderInvite, error) {
	return s.ShareFolders.ListPendingInvites(ownerID, folderID)
}

func (s *Service) RemoveMember(ownerID, folderID, memberUserID string) error {
	if memberUserID == ownerID {
		return domain.ErrInvalidInput
	}
	if err := s.assertOwnerSharingRoot(ownerID, folderID); err != nil {
		return err
	}
	return s.ShareFolders.RemoveMember(folderID, memberUserID)
}

func (s *Service) RevokeInvite(ownerID, inviteID string) error {
	return s.ShareFolders.DeleteInvite(ownerID, inviteID)
}

func (s *Service) InvitePreview(token string) (domain.FolderInvite, domain.Folder, error) {
	inv, err := s.ShareFolders.FindInviteByToken(token)
	if err != nil {
		return domain.FolderInvite{}, domain.Folder{}, err
	}
	if inv.AcceptedAt != nil {
		return domain.FolderInvite{}, domain.Folder{}, domain.ErrConflict
	}
	if time.Now().UTC().After(mustParse(inv.ExpiresAt)) {
		return domain.FolderInvite{}, domain.Folder{}, &domain.InputError{Message: "invite expired"}
	}
	ownerID, err := s.ShareFolders.GetFolderOwner(inv.FolderID)
	if err != nil {
		return domain.FolderInvite{}, domain.Folder{}, err
	}
	f, err := s.Folders.Get(ownerID, inv.FolderID)
	if err != nil {
		return domain.FolderInvite{}, domain.Folder{}, err
	}
	return inv, f, nil
}

func (s *Service) AcceptInvite(userID, token string) (domain.SharedFolderEntry, error) {
	inv, f, err := s.InvitePreview(token)
	if err != nil {
		return domain.SharedFolderEntry{}, err
	}
	u, err := s.Users.FindByID(userID)
	if err != nil {
		return domain.SharedFolderEntry{}, err
	}
	if strings.ToLower(u.Email) != strings.ToLower(inv.Email) {
		return domain.SharedFolderEntry{}, &domain.InputError{
			Message: "sign in with " + inv.Email + " to accept this invite (you are " + u.Email + ")",
		}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.ShareFolders.AddMember(uuid.NewString(), inv.FolderID, userID, domain.FolderMemberRoleMember, inv.InvitedBy, now); err != nil {
		return domain.SharedFolderEntry{}, err
	}
	if err := s.ShareFolders.MarkInviteAccepted(inv.ID, now); err != nil {
		return domain.SharedFolderEntry{}, err
	}
	ownerID, _ := s.ShareFolders.GetFolderOwner(inv.FolderID)
	return domain.SharedFolderEntry{
		Folder: f, OwnerID: ownerID, Role: domain.FolderMemberRoleMember,
	}, nil
}

func (s *Service) ListSharedFolders(userID string) ([]domain.SharedFolderEntry, error) {
	return s.ShareFolders.ListSharedFoldersForUser(userID)
}

func (s *Service) Breadcrumb(actorID, rootFolderID, folderID string) ([]domain.Breadcrumb, error) {
	if folderID == "" {
		folderID = rootFolderID
	}
	if ok, err := s.canAccessShareRoot(actorID, rootFolderID); err != nil || !ok {
		if err != nil {
			return nil, err
		}
		return nil, domain.ErrForbidden
	}
	inTree, err := s.ShareFolders.IsFolderInTree(folderID, rootFolderID)
	if err != nil {
		return nil, err
	}
	if !inTree && folderID != rootFolderID {
		return nil, domain.ErrForbidden
	}
	ownerID, err := s.ShareFolders.GetFolderOwner(rootFolderID)
	if err != nil {
		return nil, err
	}
	all, err := s.Folders.Breadcrumb(ownerID, folderID)
	if err != nil {
		return nil, err
	}
	out := []domain.Breadcrumb{}
	pastRoot := false
	for _, c := range all {
		if c.ID == rootFolderID {
			pastRoot = true
		}
		if pastRoot {
			out = append(out, c)
		}
	}
	return out, nil
}

func (s *Service) Browse(userID, rootFolderID string, parentID *string) (domain.ShareFolderBrowse, error) {
	if ok, err := s.canAccessShareRoot(userID, rootFolderID); err != nil || !ok {
		if err != nil {
			return domain.ShareFolderBrowse{}, err
		}
		return domain.ShareFolderBrowse{}, domain.ErrForbidden
	}
	ownerID, err := s.ShareFolders.GetFolderOwner(rootFolderID)
	if err != nil {
		return domain.ShareFolderBrowse{}, err
	}
	listParent := parentID
	if listParent == nil || *listParent == "" || *listParent == rootFolderID {
		listParent = &rootFolderID
	} else {
		inTree, err := s.ShareFolders.IsFolderInTree(*listParent, rootFolderID)
		if err != nil {
			return domain.ShareFolderBrowse{}, err
		}
		if !inTree {
			return domain.ShareFolderBrowse{}, domain.ErrForbidden
		}
	}
	folders, err := s.Folders.ListChildren(ownerID, listParent)
	if err != nil {
		return domain.ShareFolderBrowse{}, err
	}
	images, err := s.Images.ListInFolder(ownerID, listParent)
	if err != nil {
		return domain.ShareFolderBrowse{}, err
	}
	return domain.ShareFolderBrowse{
		Folders: folders, Images: images, RootID: rootFolderID, OwnerID: ownerID,
	}, nil
}

func (s *Service) InviteURL(token string) string {
	base := strings.TrimRight(s.FrontendURL, "/")
	return base + "/invite/share-folder/" + token
}

func (s *Service) canAccessShareRoot(userID, rootFolderID string) (bool, error) {
	ownerID, err := s.ShareFolders.GetFolderOwner(rootFolderID)
	if err != nil {
		return false, err
	}
	if ownerID == userID {
		isShare, err := s.ShareFolders.IsSharingRoot(rootFolderID)
		return isShare, err
	}
	return s.ShareFolders.IsMember(rootFolderID, userID)
}

func (s *Service) assertOwnerSharingRoot(ownerID, folderID string) error {
	_, err := s.ShareFolders.ListMembers(ownerID, folderID)
	return err
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func mustParse(ts string) time.Time {
	t, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		return time.Time{}
	}
	return t
}
