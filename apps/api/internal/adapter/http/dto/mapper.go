package dto

import "image-storage/apps/api/internal/domain"

func UserFromDomain(u domain.User) User {
	return User{ID: u.ID, Email: u.Email, DisplayName: u.DisplayName, CreatedAt: u.CreatedAt}
}

func FolderFromDomain(f domain.Folder) Folder {
	return Folder{
		ID: f.ID, ParentID: f.ParentID, Name: f.Name,
		ImageCount: f.ImageCount, TotalSize: f.TotalSize,
		CreatedAt: f.CreatedAt, UpdatedAt: f.UpdatedAt,
	}
}

func FoldersFromDomain(in []domain.Folder) []Folder {
	out := make([]Folder, len(in))
	for i, f := range in {
		out[i] = FolderFromDomain(f)
	}
	return out
}

func FolderOptionFromDomain(o domain.FolderOption) FolderOption {
	return FolderOption{
		ID: o.ID, Name: o.Name, Path: o.Path,
		ImageCount: o.ImageCount, TotalSize: o.TotalSize,
	}
}

func ImageFromDomain(img domain.Image) Image {
	tags := img.Tags
	if tags == nil {
		tags = []string{}
	}
	return Image{
		ID: img.ID, FolderID: img.FolderID, Name: img.Name, MimeType: img.MimeType,
		Size: img.Size, Visibility: img.Visibility, Favorite: img.Favorite,
		ContentHash: img.ContentHash, TakenAt: img.TakenAt, DeletedAt: img.DeletedAt,
		Tags: tags, CreatedAt: img.CreatedAt, UpdatedAt: img.UpdatedAt,
	}
}

func ImagesFromDomain(in []domain.Image) []Image {
	out := make([]Image, len(in))
	for i, img := range in {
		out[i] = ImageFromDomain(img)
	}
	return out
}

func TagFromDomain(t domain.Tag) Tag {
	return Tag{ID: t.ID, Name: t.Name, ImageCount: t.ImageCount}
}

func TagsFromDomain(in []domain.Tag) []Tag {
	out := make([]Tag, len(in))
	for i, t := range in {
		out[i] = TagFromDomain(t)
	}
	return out
}

func ShareFromDomain(s domain.Share) Share {
	return Share{
		ID: s.ID, ResourceType: s.ResourceType, ResourceID: s.ResourceID,
		Token: s.Token, URL: "/share/" + s.Token, CreatedAt: s.CreatedAt,
	}
}

func SharesFromDomain(in []domain.Share) []Share {
	out := make([]Share, len(in))
	for i, s := range in {
		out[i] = ShareFromDomain(s)
	}
	return out
}

func BreadcrumbsFromDomain(in []domain.Breadcrumb) []Breadcrumb {
	out := make([]Breadcrumb, len(in))
	for i, b := range in {
		out[i] = Breadcrumb{ID: b.ID, Name: b.Name}
	}
	return out
}

func TimelineFromDomain(groups []domain.TimelineGroup) []TimelineGroup {
	out := make([]TimelineGroup, len(groups))
	for i, g := range groups {
		out[i] = TimelineGroup{
			Period: g.Period, Label: g.Label, Images: ImagesFromDomain(g.Images),
		}
	}
	return out
}
