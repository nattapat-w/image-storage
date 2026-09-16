package imageuc

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"image-storage/apps/api/internal/domain"
)

var numberedNameSuffix = regexp.MustCompile(`^(.+?) \((\d+)\)$`)

func nameSetFromImages(images []domain.Image) map[string]bool {
	names := make(map[string]bool, len(images))
	for _, img := range images {
		names[strings.ToLower(img.Name)] = true
	}
	return names
}

func uniqueImageName(desired string, taken map[string]bool) string {
	if !nameTaken(desired, taken) {
		return desired
	}
	ext := filepath.Ext(desired)
	base := strings.TrimSuffix(desired, ext)
	stem := base
	if m := numberedNameSuffix.FindStringSubmatch(base); m != nil {
		stem = m[1]
	}
	for i := 1; i < 10000; i++ {
		candidate := fmt.Sprintf("%s (%d)%s", stem, i, ext)
		if !nameTaken(candidate, taken) {
			return candidate
		}
	}
	return fmt.Sprintf("%s (%s)%s", stem, "copy", ext)
}

func nameTaken(name string, taken map[string]bool) bool {
	return taken[strings.ToLower(name)]
}
