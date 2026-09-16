package persistence

import (
	"database/sql"
	"fmt"

	"image-storage/apps/api/internal/adapter/persistence/postgres"
	"image-storage/apps/api/internal/adapter/persistence/sqlite"
	"image-storage/apps/api/internal/config"
	"image-storage/apps/api/internal/port"
)

type Repositories struct {
	Users         port.UserRepository
	PasswordReset port.PasswordResetRepository
	Folders       port.FolderRepository
	Images        port.ImageRepository
	Tags          port.TagRepository
	Shares        port.ShareRepository
}

func Open(cfg config.Config) (*sql.DB, *Repositories, string, error) {
	if cfg.DatabaseURL != "" {
		db, err := postgres.Open(cfg.DatabaseURL)
		if err != nil {
			return nil, nil, "", err
		}
		repos := postgres.NewRepositories(db)
		return db, &Repositories{
			Users:         repos.Users,
			PasswordReset: repos.PasswordReset,
			Folders:       repos.Folders,
			Images:        repos.Images,
			Tags:          repos.Tags,
			Shares:        repos.Shares,
		}, "postgres", nil
	}

	db, err := sqlite.Open(cfg.DatabasePath)
	if err != nil {
		return nil, nil, "", err
	}
	repos := sqlite.NewRepositories(db)
	return db, &Repositories{
		Users:         repos.Users,
		PasswordReset: repos.PasswordReset,
		Folders:       repos.Folders,
		Images:        repos.Images,
		Tags:          repos.Tags,
		Shares:        repos.Shares,
	}, fmt.Sprintf("sqlite (%s)", cfg.DatabasePath), nil
}
