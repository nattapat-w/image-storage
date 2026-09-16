package port

type CDNURLResult struct {
	URL string
}

type ImageCDN interface {
	Enabled() bool
	UsePublicObjectURL() bool
	SignedURL(objectKey string, expiresIn int) (string, error)
	PublicObjectURL(objectKey string) (string, error)
}
