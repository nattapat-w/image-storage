package imagemeta

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/rwcarlsen/goexif/exif"
)

type Service struct{}

func (s *Service) Hash(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func (s *Service) TakenAt(data []byte) *string {
	x, err := exif.Decode(bytes.NewReader(data))
	if err != nil {
		return nil
	}
	tm, err := x.DateTime()
	if err != nil {
		return nil
	}
	taken := tm.UTC().Format(time.RFC3339)
	return &taken
}
