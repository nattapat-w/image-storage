package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	"github.com/joho/godotenv"

	"image-storage/apps/api/internal/adapter/auth/jwtauth"
	httpadapter "image-storage/apps/api/internal/adapter/http"
	"image-storage/apps/api/internal/adapter/imagemeta"
	"image-storage/apps/api/internal/adapter/persistence/sqlite"
	"image-storage/apps/api/internal/adapter/storage"
	"image-storage/apps/api/internal/config"
	authuc "image-storage/apps/api/internal/usecase/auth"
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

	database, err := sqlite.Open(cfg.DatabasePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "database: %v\n", err)
		os.Exit(1)
	}
	defer database.Close()

	blobStore, err := storage.NewBlobStore(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "storage: %v\n", err)
		os.Exit(1)
	}
	log.Printf("blob storage: %s", cfg.BlobBackend)

	jwtSvc := jwtauth.New(cfg.JWTSecret)
	metaSvc := &imagemeta.Service{}
	repos := sqlite.NewRepositories(database)

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
			Store: blobStore, Meta: metaSvc, MaxUpload: cfg.MaxUploadBytes,
		},
		Tags: &taguc.Service{Tags: repos.Tags, Images: repos.Images},
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
