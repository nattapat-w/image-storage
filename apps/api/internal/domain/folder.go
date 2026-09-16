package domain

type Folder struct {
	ID         string
	ParentID   *string
	Name       string
	ImageCount int64
	TotalSize  int64
	CreatedAt  string
	UpdatedAt  string
}

type FolderRow struct {
	ID       string
	ParentID *string
	Name     string
}

type FolderOption struct {
	ID         string
	Name       string
	Path       string
	ImageCount int64
	TotalSize  int64
}

type FolderStat struct {
	ImageCount int64
	TotalSize  int64
}

type Breadcrumb struct {
	ID   string
	Name string
}
