package postgres

import "database/sql"

type Repositories struct {
	Users         *UserRepo
	PasswordReset *PasswordResetRepo
	Folders       *FolderRepo
	Images        *ImageRepo
	Tags          *TagRepo
	Shares        *ShareRepo
	ShareFolders    *ShareFolderRepo
	Notifications   *NotificationRepo
}

func NewRepositories(db *sql.DB) *Repositories {
	store := NewStore(db)
	return &Repositories{
		Users:         &UserRepo{store: store},
		PasswordReset: &PasswordResetRepo{store: store},
		Folders:       &FolderRepo{store: store},
		Images:        &ImageRepo{store: store},
		Tags:          &TagRepo{store: store},
		Shares:        &ShareRepo{store: store},
		ShareFolders:  &ShareFolderRepo{store: store},
		Notifications: &NotificationRepo{store: store},
	}
}
