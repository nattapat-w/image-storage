package taguc

import (
	"strings"
	"time"

	"image-storage/apps/api/internal/domain"
	"image-storage/apps/api/internal/port"
)

type Service struct {
	Tags   port.TagRepository
	Images port.ImageRepository
}

func (s *Service) List(userID string) ([]domain.Tag, error) {
	return s.Tags.ListByUser(userID)
}

func (s *Service) SetImageTags(userID, imageID string, rawTags []string) (domain.Image, error) {
	names := normalizeTagNames(rawTags)
	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.Tags.SetImageTags(userID, imageID, names, now); err != nil {
		return domain.Image{}, err
	}
	return s.Images.GetOwned(userID, imageID)
}

func normalizeTagNames(tags []string) []string {
	seen := make(map[string]bool)
	out := []string{}
	for _, raw := range tags {
		name := strings.TrimSpace(strings.ToLower(raw))
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		out = append(out, name)
	}
	return out
}
