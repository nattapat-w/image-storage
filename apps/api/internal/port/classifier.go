package port

// ImageClassifier suggests tags from raw image bytes (local Ollama, etc.).
type ImageClassifier interface {
	Enabled() bool
	SuggestTags(imageData []byte) ([]string, error)
}
