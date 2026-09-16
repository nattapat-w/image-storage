package port

type ImageMetadata interface {
	Hash(data []byte) string
	TakenAt(data []byte) *string
}
