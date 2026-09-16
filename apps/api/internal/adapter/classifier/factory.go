package classifier

import (
	"strings"

	"image-storage/apps/api/internal/adapter/classifier/ollama"
	appconfig "image-storage/apps/api/internal/config"
	"image-storage/apps/api/internal/port"
)

func New(cfg appconfig.ClassifierConfig) port.ImageClassifier {
	switch strings.ToLower(strings.TrimSpace(cfg.Driver)) {
	case "ollama":
		return ollama.New(cfg)
	default:
		return nil
	}
}
