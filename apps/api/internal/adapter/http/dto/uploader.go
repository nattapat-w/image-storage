package dto

import (
	"strings"

	"image-storage/apps/api/internal/domain"
)

type UserByID func(id string) (domain.User, error)

func userDisplayLabel(u domain.User) string {
	if n := strings.TrimSpace(u.DisplayName); n != "" {
		return n
	}
	email := u.Email
	if at := strings.Index(email, "@"); at > 0 {
		return email[:at]
	}
	return "User"
}

func EnrichImageUploaders(imgs []Image, lookup UserByID) {
	if lookup == nil || len(imgs) == 0 {
		return
	}
	cache := make(map[string]string)
	for i := range imgs {
		uid := imgs[i].UploadedBy
		if uid == "" {
			continue
		}
		if name, ok := cache[uid]; ok {
			imgs[i].UploadedByDisplayName = name
			continue
		}
		u, err := lookup(uid)
		if err != nil {
			continue
		}
		name := userDisplayLabel(u)
		cache[uid] = name
		imgs[i].UploadedByDisplayName = name
	}
}

func EnrichImageUploader(img *Image, lookup UserByID) {
	if img == nil {
		return
	}
	slice := []Image{*img}
	EnrichImageUploaders(slice, lookup)
	*img = slice[0]
}
