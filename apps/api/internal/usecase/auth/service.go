package authuc

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"time"

	"github.com/google/uuid"

	"image-storage/apps/api/internal/domain"
	"image-storage/apps/api/internal/port"
)

type Service struct {
	Users         port.UserRepository
	PasswordReset port.PasswordResetRepository
	Tokens        port.TokenService
	Passwords     port.PasswordHasher
	FrontendURL   string
}

func (s *Service) Register(email, password string) (string, domain.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || len(password) < 8 {
		return "", domain.User{}, domain.ErrInvalidInput
	}
	hash, err := s.Passwords.Hash(password)
	if err != nil {
		return "", domain.User{}, err
	}
	id := uuid.NewString()
	now := time.Now().UTC().Format(time.RFC3339)
	user := domain.User{ID: id, Email: email, CreatedAt: now}
	if err := s.Users.Create(user, hash, now); err != nil {
		return "", domain.User{}, err
	}
	token, err := s.Tokens.Issue(id)
	return token, user, err
}

func (s *Service) Login(email, password string) (string, domain.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	u, hash, err := s.Users.FindByEmail(email)
	if err != nil {
		return "", domain.User{}, domain.ErrUnauthorized
	}
	if err := s.Passwords.Check(hash, password); err != nil {
		return "", domain.User{}, domain.ErrUnauthorized
	}
	token, err := s.Tokens.Issue(u.ID)
	return token, u, err
}

func (s *Service) Me(userID string) (domain.User, error) {
	return s.Users.FindByID(userID)
}

func (s *Service) UpdateAutoTagEnabled(userID string, enabled bool) (domain.User, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.Users.UpdateAutoTagEnabled(userID, enabled, now); err != nil {
		return domain.User{}, err
	}
	return s.Users.FindByID(userID)
}

func (s *Service) UpdateProfile(userID, email, displayName string) (domain.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	displayName = strings.TrimSpace(displayName)
	if email == "" {
		return domain.User{}, domain.ErrInvalidInput
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.Users.UpdateProfile(userID, email, displayName, now); err != nil {
		return domain.User{}, err
	}
	return s.Users.FindByID(userID)
}

func (s *Service) ChangePassword(userID, currentPassword, newPassword string) error {
	if len(newPassword) < 8 {
		return domain.ErrInvalidInput
	}
	user, err := s.Users.FindByID(userID)
	if err != nil {
		return err
	}
	_, storedHash, err := s.Users.FindByEmail(user.Email)
	if err != nil {
		return err
	}
	if err := s.Passwords.Check(storedHash, currentPassword); err != nil {
		return domain.ErrUnauthorized
	}
	newHash, err := s.Passwords.Hash(newPassword)
	if err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	return s.Users.UpdatePassword(userID, newHash, now)
}

func (s *Service) ForgotPassword(email string) (string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return "", domain.ErrInvalidInput
	}
	u, _, err := s.Users.FindByEmail(email)
	if err != nil {
		if err == domain.ErrNotFound {
			return "", nil
		}
		return "", err
	}
	token, tokenHash, err := newResetToken()
	if err != nil {
		return "", err
	}
	now := time.Now().UTC()
	expires := now.Add(time.Hour).Format(time.RFC3339)
	if err := s.PasswordReset.Create(u.ID, tokenHash, expires, now.Format(time.RFC3339)); err != nil {
		return "", err
	}
	if s.FrontendURL == "" {
		return token, nil
	}
	return strings.TrimRight(s.FrontendURL, "/") + "/reset-password?token=" + token, nil
}

func (s *Service) ResetPassword(token, newPassword string) error {
	if len(newPassword) < 8 || strings.TrimSpace(token) == "" {
		return domain.ErrInvalidInput
	}
	tokenHash := hashToken(token)
	now := time.Now().UTC().Format(time.RFC3339)
	userID, err := s.PasswordReset.FindUserIDByTokenHash(tokenHash, now)
	if err != nil {
		return domain.ErrUnauthorized
	}
	newHash, err := s.Passwords.Hash(newPassword)
	if err != nil {
		return err
	}
	updatedAt := time.Now().UTC().Format(time.RFC3339)
	if err := s.Users.UpdatePassword(userID, newHash, updatedAt); err != nil {
		return err
	}
	_ = s.PasswordReset.DeleteByUser(userID)
	return nil
}

func (s *Service) DeleteAccount(userID, password string) error {
	user, err := s.Users.FindByID(userID)
	if err != nil {
		return err
	}
	_, storedHash, err := s.Users.FindByEmail(user.Email)
	if err != nil {
		return err
	}
	if err := s.Passwords.Check(storedHash, password); err != nil {
		return domain.ErrUnauthorized
	}
	_ = s.PasswordReset.DeleteByUser(userID)
	return s.Users.Delete(userID)
}

func newResetToken() (string, string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}
	token := base64.RawURLEncoding.EncodeToString(buf)
	return token, hashToken(token), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
