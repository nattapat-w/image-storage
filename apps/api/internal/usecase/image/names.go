package imageuc

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"image-storage/apps/api/internal/domain"
)

var numberedNameSuffix = regexp.MustCompile(`^(.+?) \((\d+)\)$`)

const maxUploadFilenameLen = 180

func sanitizeUploadFilename(name string) string {
	name = strings.TrimSpace(name)
	name = strings.ReplaceAll(name, "\x00", "")
	name = filepath.Base(name)
	if name == "" || name == "." {
		return ""
	}
	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	if len(name) <= maxUploadFilenameLen {
		return name
	}
	maxBaseLen := maxUploadFilenameLen - len(ext)
	if maxBaseLen < 1 {
		return name[:maxUploadFilenameLen]
	}
	if len(base) > maxBaseLen {
		base = base[:maxBaseLen]
	}
	return base + ext
}

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
