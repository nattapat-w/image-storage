# image-storage

Google Drive–style image storage: auth, folders, upload/download, public/private, share links.

## Stack

- **apps/web** — Next.js 16, Tailwind
- **apps/api** — Go, chi, SQLite, JWT, local file storage

## Prerequisites

- Node 22+, pnpm 11
- Go 1.27+

## Run

```bash
pnpm install
pnpm dev
```

- App: http://localhost:3000
- Register → Dashboard → upload, folders, public/private, share links

## Scripts

| Script | Action |
|---|---|
| `pnpm dev` | Kill :3000/:8080, start web + API |
| `pnpm build` | Production build |
| `pnpm test` | Go tests |

## Features

- Email/password auth (JWT, 7-day token)
- Nested folders, breadcrumb navigation
- Image upload (JPEG, PNG, GIF, WebP, max 20MB)
- Sort by name, date, size
- Visibility: **private** (owner only) or **public** (anyone with link)
- **Share links** for images or folders (`/share/{token}`)
- Download from dashboard or share page

## API (prefix `/api`)

| Method | Path | Auth |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | No |
| GET | `/auth/me` | Yes |
| CRUD | `/folders`, `/folders/breadcrumb` | Yes |
| CRUD | `/images`, `/images/{id}/file` | Yes |
| GET | `/public/images/{id}/file` | No (public only) |
| CRUD | `/shares` | Yes |
| GET | `/share/{token}` | No |

## Config

See `apps/api/.env.example`. Data lives under `apps/api/data/` (gitignored).
