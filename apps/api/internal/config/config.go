package config

import (
	"fmt"
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

type SupabaseConfig struct {
	URL            string
	ServiceRoleKey string
	Bucket         string
	PublicBucket   bool
}

type ClassifierConfig struct {
	Driver          string
	OllamaURL       string
	OllamaModel     string
	AutoTagOnUpload bool
	TagPrefix       string
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
	Supabase       SupabaseConfig
	Classifier     ClassifierConfig
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
	case "supabase":
		blobBackend = "supabase"
		storageDriver = "s3"
		usePathStyle = true
		skipBucketCreate = true
		if s3Endpoint == "" {
			s3Endpoint = supabaseStorageEndpoint()
		}
		if s3Region == "" {
			s3Region = "us-east-1"
		}
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
		} else if isSupabaseEndpoint(s3Endpoint) {
			blobBackend = "supabase"
			usePathStyle = true
			skipBucketCreate = true
			if s3Region == "" {
				s3Region = "us-east-1"
			}
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

	if storageDriver == "local" && isSupabaseEndpoint(s3Endpoint) && accessKey != "" && secretKey != "" {
		blobBackend = "supabase"
		storageDriver = "s3"
		usePathStyle = true
		skipBucketCreate = true
		if s3Region == "" {
			s3Region = "us-east-1"
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

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = supabaseDatabaseURL()
	}

	supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	if supabaseURL == "" {
		ref := strings.TrimSpace(os.Getenv("SUPABASE_PROJECT_REF"))
		if ref == "" {
			ref = supabaseProjectRefFromDatabaseURL(databaseURL)
		}
		if ref == "" {
			ref = supabaseProjectRefFromStorageEndpoint(s3Endpoint)
		}
		if ref != "" {
			supabaseURL = fmt.Sprintf("https://%s.supabase.co", ref)
		}
	}
	supabaseBucket := s3Bucket
	if v := strings.TrimSpace(os.Getenv("SUPABASE_STORAGE_BUCKET")); v != "" {
		supabaseBucket = v
	}

	classifierDriver := strings.ToLower(strings.TrimSpace(os.Getenv("IMAGE_CLASSIFIER")))
	ollamaURL := strings.TrimSpace(os.Getenv("OLLAMA_URL"))
	if ollamaURL == "" {
		ollamaURL = "http://127.0.0.1:11435"
	}
	ollamaModel := strings.TrimSpace(os.Getenv("OLLAMA_MODEL"))
	if ollamaModel == "" {
		ollamaModel = "phototagger"
	}
	autoTagOnUpload := strings.EqualFold(os.Getenv("AUTO_TAG_ON_UPLOAD"), "true")
	tagPrefix := strings.TrimSpace(os.Getenv("AUTO_TAG_PREFIX"))

	return Config{
		Host:           host,
		Port:           port,
		DatabasePath:   dbPath,
		DatabaseURL:    databaseURL,
		StorageDriver:  storageDriver,
		BlobBackend:    blobBackend,
		StoragePath:    storagePath,
		Classifier: ClassifierConfig{
			Driver:          classifierDriver,
			OllamaURL:       ollamaURL,
			OllamaModel:     ollamaModel,
			AutoTagOnUpload: autoTagOnUpload,
			TagPrefix:       tagPrefix,
		},
		S3: S3Config{
			Endpoint:         s3Endpoint,
			Region:           s3Region,
			Bucket:           s3Bucket,
			AccessKey:        accessKey,
			SecretKey:        secretKey,
			UsePathStyle:     usePathStyle,
			SkipBucketCreate: skipBucketCreate,
		},
		Supabase: SupabaseConfig{
			URL:            supabaseURL,
			ServiceRoleKey: firstEnv("SUPABASE_SERVICE_ROLE_KEY"),
			Bucket:         supabaseBucket,
			PublicBucket:   strings.EqualFold(os.Getenv("SUPABASE_BUCKET_PUBLIC"), "true"),
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

func isSupabaseEndpoint(endpoint string) bool {
	lower := strings.ToLower(endpoint)
	return strings.Contains(lower, ".storage.supabase.co") ||
		(strings.Contains(lower, ".supabase.co") && strings.Contains(lower, "/storage/v1/s3"))
}

func supabaseStorageEndpoint() string {
	ref := strings.TrimSpace(os.Getenv("SUPABASE_PROJECT_REF"))
	if ref == "" {
		ref = supabaseProjectRefFromDatabaseURL(os.Getenv("DATABASE_URL"))
	}
	if ref == "" {
		ref = supabaseProjectRefFromDatabaseURL(supabaseDatabaseURL())
	}
	if ref == "" {
		return ""
	}
	return fmt.Sprintf("https://%s.storage.supabase.co/storage/v1/s3", ref)
}

func supabaseProjectRefFromStorageEndpoint(endpoint string) string {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return ""
	}
	lower := strings.ToLower(endpoint)
	if i := strings.Index(lower, "://"); i >= 0 {
		lower = lower[i+3:]
	}
	if i := strings.Index(lower, ".storage.supabase.co"); i > 0 {
		return lower[:i]
	}
	return ""
}

func supabaseProjectRefFromDatabaseURL(databaseURL string) string {
	databaseURL = strings.TrimSpace(databaseURL)
	if databaseURL == "" {
		return ""
	}
	// db.[ref].supabase.co
	if i := strings.Index(databaseURL, "db."); i >= 0 {
		rest := databaseURL[i+3:]
		if j := strings.Index(rest, ".supabase.co"); j > 0 {
			return rest[:j]
		}
	}
	// postgres.[ref]@...pooler.supabase.com
	if i := strings.Index(databaseURL, "postgres."); i >= 0 {
		rest := databaseURL[i+9:]
		if j := strings.Index(rest, "@"); j > 0 {
			return rest[:j]
		}
	}
	return ""
}

func supabaseDatabaseURL() string {
	host := strings.TrimSpace(os.Getenv("SUPABASE_DB_HOST"))
	password := firstEnv("DATABASE_SUPABASE_PASSWORD", "SUPABASE_DB_PASSWORD")
	if host == "" || password == "" {
		return ""
	}
	user := strings.TrimSpace(os.Getenv("SUPABASE_DB_USER"))
	if user == "" {
		user = "postgres"
	}
	port := strings.TrimSpace(os.Getenv("SUPABASE_DB_PORT"))
	if port == "" {
		port = "5432"
	}
	dbName := strings.TrimSpace(os.Getenv("SUPABASE_DB_NAME"))
	if dbName == "" {
		dbName = "postgres"
	}
	return fmt.Sprintf("postgresql://%s:%s@%s:%s/%s?sslmode=require",
		user, password, host, port, dbName)
}

func isLocalS3Endpoint(endpoint string) bool {
	lower := strings.ToLower(endpoint)
	return strings.Contains(lower, "127.0.0.1") ||
		strings.Contains(lower, "localhost") ||
		strings.Contains(lower, ":9000")
}
