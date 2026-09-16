package local

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"image-storage/apps/api/internal/port"
)

type Store struct {
	root string
}

func New(root string) (*Store, error) {
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}
	return &Store{root: root}, nil
}

func (l *Store) Path(key string) string {
	return filepath.Join(l.root, filepath.FromSlash(key))
}

func (l *Store) Save(key string, r io.Reader) error {
	path := l.Path(key)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, r)
	return err
}

func (l *Store) Open(key string) (port.BlobObject, error) {
	path := l.Path(key)
	f, err := os.Open(path)
	if err != nil {
		return port.BlobObject{}, err
	}
	stat, err := f.Stat()
	if err != nil {
		f.Close()
		return port.BlobObject{}, err
	}
	return port.BlobObject{Body: f, Size: stat.Size()}, nil
}

func (l *Store) Delete(key string) error {
	err := os.Remove(l.Path(key))
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

func (l *Store) Key(userID, imageID, filename string) string {
	return fmt.Sprintf("%s/%s/%s", userID, imageID, filename)
}
