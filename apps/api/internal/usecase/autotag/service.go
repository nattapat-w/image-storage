package autotaguc

import (
	"log"
	"strings"

	"image-storage/apps/api/internal/port"
	taguc "image-storage/apps/api/internal/usecase/tag"
)

type Service struct {
	Classifier      port.ImageClassifier
	Tags            *taguc.Service
	Images          port.ImageRepository
	Users           port.UserRepository
	Status          *StatusTracker
	AutoTagOnUpload bool
	TagPrefix       string
}

func (s *Service) ListStatus(userID string, imageIDs []string) []JobStatus {
	if s == nil || s.Status == nil {
		return nil
	}
	return s.Status.List(userID, imageIDs)
}

func (s *Service) AfterUpload(userID, imageID string, data []byte) {
	if s == nil || s.Classifier == nil || !s.Classifier.Enabled() || !s.AutoTagOnUpload {
		return
	}
	if s.Users != nil {
		user, err := s.Users.FindByID(userID)
		if err != nil || !user.AutoTagEnabled {
			return
		}
	}
	if len(data) == 0 {
		return
	}
	if s.Status != nil {
		s.Status.Start(userID, imageID)
	}
	imgData := append([]byte(nil), data...)
	go s.run(userID, imageID, imgData)
}

func (s *Service) run(userID, imageID string, data []byte) {
	log.Printf("autotag: started image %s", imageID)
	tags, err := s.Classifier.SuggestTags(data)
	if err != nil {
		log.Printf("autotag: classify image %s: %v", imageID, err)
		if s.Status != nil {
			s.Status.Fail(userID, imageID, err.Error())
		}
		return
	}
	if len(tags) == 0 {
		log.Printf("autotag: no tags returned for image %s", imageID)
		if s.Status != nil {
			s.Status.Fail(userID, imageID, "model returned no tags")
		}
		return
	}

	prefix := strings.TrimSpace(s.TagPrefix)
	prefixed := make([]string, 0, len(tags))
	for _, tag := range tags {
		if prefix != "" && !strings.HasPrefix(tag, prefix) {
			tag = prefix + tag
		}
		prefixed = append(prefixed, tag)
	}

	merged := prefixed
	if s.Images != nil {
		if img, err := s.Images.GetOwned(userID, imageID); err == nil {
			merged = mergeTags(img.Tags, prefixed, prefix)
		}
	}

	if _, err := s.Tags.SetImageTags(userID, imageID, merged); err != nil {
		log.Printf("autotag: save tags image %s: %v", imageID, err)
		if s.Status != nil {
			s.Status.Fail(userID, imageID, err.Error())
		}
		return
	}
	if s.Status != nil {
		s.Status.Done(userID, imageID)
	}
	log.Printf("autotag: tagged image %s with %v", imageID, merged)
}

func mergeTags(existing, aiTags []string, aiPrefix string) []string {
	seen := make(map[string]bool, len(existing)+len(aiTags))
	out := make([]string, 0, len(existing)+len(aiTags))
	for _, tag := range existing {
		if aiPrefix != "" && strings.HasPrefix(tag, aiPrefix) {
			continue
		}
		if seen[tag] {
			continue
		}
		seen[tag] = true
		out = append(out, tag)
	}
	for _, tag := range aiTags {
		if seen[tag] {
			continue
		}
		seen[tag] = true
		out = append(out, tag)
	}
	return out
}
