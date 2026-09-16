package port

import "io"

// BlobObject is a readable blob with a known size (for Content-Length).
type BlobObject struct {
	Body io.ReadCloser
	Size int64
}

type BlobStore interface {
	Save(key string, r io.Reader) error
	Open(key string) (BlobObject, error)
	Delete(key string) error
	Key(userID, imageID, filename string) string
}
