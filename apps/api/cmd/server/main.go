package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	"github.com/joho/godotenv"

	"image-storage/apps/api/internal/adapter/auth/jwtauth"
	"image-storage/apps/api/internal/adapter/classifier"
	supabasecdn "image-storage/apps/api/internal/adapter/cdn/supabase"
	httpadapter "image-storage/apps/api/internal/adapter/http"
	"image-storage/apps/api/internal/adapter/imagemeta"
	"image-storage/apps/api/internal/adapter/persistence"
	"image-storage/apps/api/internal/adapter/storage"
	"image-storage/apps/api/internal/config"
	"image-storage/apps/api/internal/port"
	authuc "image-storage/apps/api/internal/usecase/auth"
	autotaguc "image-storage/apps/api/internal/usecase/autotag"
	folderuc "image-storage/apps/api/internal/usecase/folder"
	imageuc "image-storage/apps/api/internal/usecase/image"
	shareuc "image-storage/apps/api/internal/usecase/share"
	taguc "image-storage/apps/api/internal/usecase/tag"
)

func main() {
	// Prefer explicit profile file (pnpm dev:local / dev:neon); fallback for bare go run.
	for _, name := range []string{os.Getenv("APP_ENV_FILE"), ".env.local", ".env"} {
		if name != "" {
			_ = godotenv.Load(name)
		}
	}
	cfg := config.Load()

	database, repos, dbBackend, err := persistence.Open(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "database: %v\n", err)
		os.Exit(1)
	}
	defer database.Close()
	log.Printf("database: %s", dbBackend)

	blobStore, err := storage.NewBlobStore(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "storage: %v\n", err)
		os.Exit(1)
	}
	log.Printf("blob storage: %s", cfg.BlobBackend)

	var cdnSvc port.ImageCDN
	if cfg.BlobBackend == "supabase" {
		cdnSvc = supabasecdn.New(cfg.Supabase)
		if cdnSvc.Enabled() {
			log.Printf("image cdn: supabase signed urls")
		}
	}

	jwtSvc := jwtauth.New(cfg.JWTSecret)
	metaSvc := &imagemeta.Service{}

	tagSvc := &taguc.Service{Tags: repos.Tags, Images: repos.Images}
	classifierSvc := classifier.New(cfg.Classifier)
	autoTagStatus := autotaguc.NewStatusTracker()
	var autoTagSvc *autotaguc.Service
	if classifierSvc != nil {
		autoTagSvc = &autotaguc.Service{
			Classifier:      classifierSvc,
			Tags:            tagSvc,
			Images:          repos.Images,
			Users:           repos.Users,
			Status:          autoTagStatus,
			AutoTagOnUpload: cfg.Classifier.AutoTagOnUpload,
			TagPrefix:       cfg.Classifier.TagPrefix,
		}
		log.Printf("image classifier: ollama (%s, model=%s, auto_tag=%v)",
			cfg.Classifier.OllamaURL, cfg.Classifier.OllamaModel, cfg.Classifier.AutoTagOnUpload)
	}

	handler := httpadapter.NewRouter(httpadapter.Services{
		Auth: &authuc.Service{
			Users:         repos.Users,
			PasswordReset: repos.PasswordReset,
			Tokens:        jwtSvc,
			Passwords:     jwtSvc,
			FrontendURL:   cfg.FrontendURL,
		},
		Folders: &folderuc.Service{Folders: repos.Folders},
		Images: &imageuc.Service{
			Images: repos.Images, Folders: repos.Folders,
			Store: blobStore, CDN: cdnSvc, Meta: metaSvc, MaxUpload: cfg.MaxUploadBytes,
		},
		Tags:    tagSvc,
		AutoTag: autoTagSvc,
		Shares: &shareuc.Service{
			Shares: repos.Shares, Images: repos.Images, Folders: repos.Folders, Store: blobStore,
		},
		JWT:            jwtSvc,
		EnableDevTools: cfg.EnableDevTools,
	})

	addr := net.JoinHostPort(cfg.Host, cfg.Port)
	log.Printf("api listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		fmt.Fprintf(os.Stderr, "listen %s: %v\n", addr, err)
		os.Exit(1)
	}
}
