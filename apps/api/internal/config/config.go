package config

import (
	"os"
	"strconv"
	"strings"
)

type S3Config struct {
	Endpoint         string
	Region           string
	Bucket           string
	AccessKey        string
	SecretKey        string
	UsePathStyle     bool
	SkipBucketCreate bool
}

type Config struct {
	Host           string
	Port           string
	DatabasePath   string
	DatabaseURL    string
	StorageDriver  string
	BlobBackend    string
	StoragePath    string
	S3             S3Config
	JWTSecret      string
	MaxUploadBytes int64
	FrontendURL    string
	EnableDevTools bool
}

func Load() Config {
	maxUpload := int64(20 << 20)
	if v := os.Getenv("MAX_UPLOAD_BYTES"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			maxUpload = n
		}
	}
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-secret-change-in-production"
	}
	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "data/app.db"
	}
	storagePath := os.Getenv("STORAGE_PATH")
	if storagePath == "" {
		storagePath = "data/storage"
	}
	host := os.Getenv("HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	storageDriver := strings.ToLower(strings.TrimSpace(os.Getenv("STORAGE_DRIVER")))
	if storageDriver == "" {
		storageDriver = "local"
	}
	blobBackend := storageDriver

	s3Endpoint := firstEnv("S3_ENDPOINT", "AWS_ENDPOINT_URL_S3")
	s3Region := firstEnv("S3_REGION", "AWS_REGION")
	usePathStyle := strings.EqualFold(os.Getenv("S3_USE_PATH_STYLE"), "true")
	skipBucketCreate := strings.EqualFold(os.Getenv("S3_SKIP_BUCKET_CREATE"), "true")
	accessKey := firstEnv("S3_ACCESS_KEY", "AWS_ACCESS_KEY_ID")
	secretKey := firstEnv("S3_SECRET_KEY", "AWS_SECRET_ACCESS_KEY")
	s3Bucket := os.Getenv("S3_BUCKET")

	switch storageDriver {
	case "neon":
		blobBackend = "neon"
		storageDriver = "s3"
		usePathStyle = true
		skipBucketCreate = true
		if s3Region == "" {
			s3Region = "us-east-2"
		}
	case "r2":
		blobBackend = "r2"
		storageDriver = "s3"
		if s3Region == "" {
			s3Region = "auto"
		}
		usePathStyle = true
		skipBucketCreate = true
	case "s3":
		if isNeonEndpoint(s3Endpoint) {
			blobBackend = "neon"
			usePathStyle = true
			skipBucketCreate = true
			if s3Region == "" {
				s3Region = "us-east-2"
			}
		} else if isR2Endpoint(s3Endpoint) {
			blobBackend = "r2"
			if s3Region == "" {
				s3Region = "auto"
			}
			usePathStyle = true
			skipBucketCreate = true
		} else if s3Endpoint != "" {
			usePathStyle = true
		}
		if s3Region == "" {
			s3Region = "us-east-1"
		}
	}

	// neon env pull sets AWS_* only — infer driver when endpoint is Neon.
	if storageDriver == "local" && isNeonEndpoint(s3Endpoint) && accessKey != "" && secretKey != "" {
		blobBackend = "neon"
		storageDriver = "s3"
		usePathStyle = true
		skipBucketCreate = true
		if s3Region == "" {
			s3Region = "us-east-2"
		}
	}

	if storageDriver == "s3" && isLocalS3Endpoint(s3Endpoint) {
		if accessKey == "" {
			accessKey = "minioadmin"
		}
		if secretKey == "" {
			secretKey = "minioadmin"
		}
	}

	return Config{
		Host:           host,
		Port:           port,
		DatabasePath:   dbPath,
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		StorageDriver:  storageDriver,
		BlobBackend:    blobBackend,
		StoragePath:    storagePath,
		S3: S3Config{
			Endpoint:         s3Endpoint,
			Region:           s3Region,
			Bucket:           s3Bucket,
			AccessKey:        accessKey,
			SecretKey:        secretKey,
			UsePathStyle:     usePathStyle,
			SkipBucketCreate: skipBucketCreate,
		},
		JWTSecret:      secret,
		MaxUploadBytes: maxUpload,
		FrontendURL:    frontendURL,
		EnableDevTools: strings.EqualFold(os.Getenv("ENABLE_DEV_TOOLS"), "true"),
	}
}

func firstEnv(keys ...string) string {
	for _, key := range keys {
		if v := strings.TrimSpace(os.Getenv(key)); v != "" {
			return v
		}
	}
	return ""
}

func isNeonEndpoint(endpoint string) bool {
	lower := strings.ToLower(endpoint)
	return strings.Contains(lower, "neon.tech") && strings.Contains(lower, ".storage.")
}

func isR2Endpoint(endpoint string) bool {
	return strings.Contains(strings.ToLower(endpoint), "r2.cloudflarestorage.com")
}

func isLocalS3Endpoint(endpoint string) bool {
	lower := strings.ToLower(endpoint)
	return strings.Contains(lower, "127.0.0.1") ||
		strings.Contains(lower, "localhost") ||
		strings.Contains(lower, ":9000")
}
