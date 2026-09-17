package sharefolderuc

import (
	"archive/zip"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"

	"image-storage/apps/api/internal/domain"
)

const MaxFolderZipBytes int64 = 500 * 1024 * 1024

type FolderZipEntry struct {
	ZipPath string
	ImageID string
}

func (s *Service) PrepareFolderZip(actorID, folderID string) (folderName string, entries []FolderZipEntry, totalBytes int64, err error) {
	shareRootID, ownerID, ok, err := s.ShareFolders.ResolveShareRoot(folderID)
	if err != nil {
		return "", nil, 0, err
	}
	if !ok {
		isShare, err := s.ShareFolders.IsSharingRoot(folderID)
		if err != nil || !isShare {
			return "", nil, 0, domain.ErrForbidden
		}
		shareRootID = folderID
		ownerID, err = s.ShareFolders.GetFolderOwner(folderID)
		if err != nil {
			return "", nil, 0, err
		}
	}
	if can, err := s.canAccessShareRoot(actorID, shareRootID); err != nil || !can {
		if err != nil {
			return "", nil, 0, err
		}
		return "", nil, 0, domain.ErrForbidden
	}
	inTree, err := s.ShareFolders.IsFolderInTree(folderID, shareRootID)
	if err != nil {
		return "", nil, 0, err
	}
	if !inTree && folderID != shareRootID {
		return "", nil, 0, domain.ErrForbidden
	}

	f, err := s.Folders.Get(ownerID, folderID)
	if err != nil {
		return "", nil, 0, err
	}
	images, err := s.Images.ListInFolderTree(ownerID, folderID)
	if err != nil {
		return "", nil, 0, err
	}
	rows, err := s.Folders.ListRows(ownerID)
	if err != nil {
		return "", nil, 0, err
	}
	nameByID := make(map[string]string, len(rows))
	parentByID := make(map[string]*string, len(rows))
	for _, row := range rows {
		nameByID[row.ID] = row.Name
		parentByID[row.ID] = row.ParentID
	}

	var total int64
	usedNames := make(map[string]bool)
	entries = make([]FolderZipEntry, 0, len(images))
	for _, img := range images {
		total += img.Size
		if total > MaxFolderZipBytes {
			return "", nil, total, &domain.InputError{
				Message: fmt.Sprintf(
					"folder exceeds %d MB download limit; try a smaller subfolder",
					MaxFolderZipBytes/(1024*1024),
				),
			}
		}
		if img.FolderID == nil {
			continue
		}
		rel := relativeFolderPath(folderID, *img.FolderID, nameByID, parentByID)
		zipPath := uniqueZipPath(usedNames, joinZipPath(rel, sanitizeZipFilename(img.Name)))
		entries = append(entries, FolderZipEntry{ZipPath: zipPath, ImageID: img.ID})
	}

	return f.Name, entries, total, nil
}

func (s *Service) StreamFolderZip(w http.ResponseWriter, actorID, folderID string) error {
	name, entries, _, err := s.PrepareFolderZip(actorID, folderID)
	if err != nil {
		return err
	}
	if s.ImageUC == nil {
		return domain.ErrInvalidInput
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", zipContentDisposition(name))
	zw := zip.NewWriter(w)
	defer func() { _ = zw.Close() }()

	for _, ent := range entries {
		meta, err := s.Images.GetFileMeta(ent.ImageID)
		if err != nil {
			return err
		}
		obj, err := s.ImageUC.OpenFile(meta)
		if err != nil {
			return err
		}
		h := &zip.FileHeader{Name: ent.ZipPath, Method: zip.Deflate}
		fw, err := zw.CreateHeader(h)
		if err != nil {
			_ = obj.Body.Close()
			return err
		}
		if _, err := io.Copy(fw, obj.Body); err != nil {
			_ = obj.Body.Close()
			return err
		}
		_ = obj.Body.Close()
	}
	return zw.Close()
}

func zipContentDisposition(folderName string) string {
	safe := sanitizeZipFilename(folderName)
	if safe == "" {
		safe = "folder"
	}
	return fmt.Sprintf(`attachment; filename="%s.zip"`, safe)
}

func relativeFolderPath(downloadRoot, folderID string, names map[string]string, parents map[string]*string) string {
	if folderID == downloadRoot {
		return ""
	}
	var parts []string
	cur := folderID
	for cur != downloadRoot {
		parts = append(parts, names[cur])
		p := parents[cur]
		if p == nil {
			break
		}
		cur = *p
	}
	for i, j := 0, len(parts)-1; i < j; i, j = i+1, j-1 {
		parts[i], parts[j] = parts[j], parts[i]
	}
	return strings.Join(parts, "/")
}

func joinZipPath(dir, file string) string {
	if dir == "" {
		return file
	}
	return dir + "/" + file
}

func sanitizeZipFilename(name string) string {
	name = strings.ReplaceAll(name, `\`, "_")
	name = strings.ReplaceAll(name, `/`, "_")
	name = strings.TrimSpace(name)
	if name == "" {
		return "image"
	}
	return name
}

func uniqueZipPath(used map[string]bool, desired string) string {
	if !used[desired] {
		used[desired] = true
		return desired
	}
	ext := path.Ext(desired)
	base := strings.TrimSuffix(desired, ext)
	for i := 2; i < 10_000; i++ {
		candidate := fmt.Sprintf("%s (%d)%s", base, i, ext)
		if !used[candidate] {
			used[candidate] = true
			return candidate
		}
	}
	used[desired] = true
	return desired
}
