package postgres

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  auto_tag_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_share_folder BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_folders_user_parent ON folders(user_id, parent_id);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  storage_key TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  favorite BOOLEAN NOT NULL DEFAULT false,
  content_hash TEXT,
  taken_at TEXT,
  deleted_at TEXT,
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folder_members (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT REFERENCES users(id),
  joined_at TEXT NOT NULL,
  UNIQUE(folder_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_folder_members_user ON folder_members(user_id);

CREATE TABLE IF NOT EXISTS folder_invites (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_folder_invites_folder ON folder_invites(folder_id);

CREATE INDEX IF NOT EXISTS idx_images_user_folder ON images(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_images_user_hash ON images(user_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_images_deleted ON images(user_id, deleted_at);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);

CREATE TABLE IF NOT EXISTS image_tags (
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (image_id, tag_id)
);

CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
`

func Open(url string) (*sql.DB, error) {
	cfg, err := pgx.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	// Supabase pooler (PgBouncer, port 6543) rejects cached prepared statements (SQLSTATE 42P05).
	if needsSimpleProtocol(url) {
		cfg.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	}
	db := stdlib.OpenDB(*cfg)
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	if err := migrate(db); err != nil {
		return nil, fmt.Errorf("migrate columns: %w", err)
	}
	return db, nil
}

func migrate(db *sql.DB) error {
	_, _ = db.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_tag_enabled BOOLEAN NOT NULL DEFAULT false`)
	_, _ = db.Exec(`ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_share_folder BOOLEAN NOT NULL DEFAULT false`)
	_, _ = db.Exec(`ALTER TABLE images ADD COLUMN IF NOT EXISTS uploaded_by TEXT REFERENCES users(id)`)
	_, _ = db.Exec(`UPDATE images SET uploaded_by = user_id WHERE uploaded_by IS NULL`)
	_, _ = db.Exec(`
CREATE TABLE IF NOT EXISTS folder_members (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT REFERENCES users(id),
  joined_at TEXT NOT NULL,
  UNIQUE(folder_id, user_id)
)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_folder_members_user ON folder_members(user_id)`)
	_, _ = db.Exec(`
CREATE TABLE IF NOT EXISTS folder_invites (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL
)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_folder_invites_folder ON folder_invites(folder_id)`)
	_, _ = db.Exec(`
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT NOT NULL,
  ref_type TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, ref_type, ref_id)
)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC)`)
	_, _ = db.Exec(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS expires_at TEXT`)
	return nil
}

type Store struct {
	DB *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{DB: db}
}

func needsSimpleProtocol(databaseURL string) bool {
	lower := strings.ToLower(databaseURL)
	if strings.Contains(lower, "pooler.supabase.com") || strings.Contains(lower, "pgbouncer=true") {
		return true
	}
	// Session/transaction pooler default port on Supabase.
	return strings.Contains(lower, ":6543/")
}
