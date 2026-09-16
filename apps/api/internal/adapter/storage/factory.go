package storage

import (
	"fmt"
	"strings"

	"image-storage/apps/api/internal/adapter/storage/local"
	s3store "image-storage/apps/api/internal/adapter/storage/s3"
	appconfig "image-storage/apps/api/internal/config"
	"image-storage/apps/api/internal/port"
)

func NewBlobStore(cfg appconfig.Config) (port.BlobStore, error) {
	switch strings.ToLower(cfg.StorageDriver) {
	case "s3", "r2", "neon":
		return s3store.New(cfg.S3)
	case "local", "":
		return local.New(cfg.StoragePath)
	default:
		return nil, fmt.Errorf("unknown STORAGE_DRIVER: %s (use local, neon, r2, or s3)", cfg.StorageDriver)
	}
}
