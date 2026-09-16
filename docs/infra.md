# Infrastructure

Modular monolith: one Go API, pluggable storage adapters.

## Blob storage

| Driver | Use case |
|--------|----------|
| `local` (default) | Solo dev, no cloud |
| `neon` | Neon Object Storage (S3 API, free beta, no credit card) |
| `supabase` | Supabase Storage S3 API (pairs with `pnpm dev:supabase`) |
| `r2` | Cloudflare R2 (requires card/PayPal) |
| `s3` | MinIO local dev, AWS S3 |

**Neon setup:** [neon-storage-setup.md](./neon-storage-setup.md)

**Supabase Storage:** copy `apps/api/.env.supabase.example` → `.env.supabase`, create a bucket in the Supabase dashboard, and generate S3 access keys under **Storage → S3 Configuration**. Set `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API) for CDN signed URLs. Keep the bucket **private**; the app gates access and mints signed URLs.

### Quick: Neon on Render

```env
STORAGE_DRIVER=neon
S3_BUCKET=image-storage
AWS_ENDPOINT_URL_S3=https://br-....storage....neon.tech
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=nak_live_...
AWS_SECRET_ACCESS_KEY=nsk_live_...
```

### Local dev with MinIO

```bash
pnpm infra:up
pnpm dev:s3
```

## Database

| Store | Status |
|-------|--------|
| **SQLite** | Default when `DATABASE_URL` is unset — `DATABASE_PATH` |
| **Supabase Postgres** | Set `DATABASE_URL` or Supabase host + password — `pnpm dev:supabase` |
| **Postgres (generic)** | Any Postgres via `DATABASE_URL` |

## Architecture

```
Vercel (Next.js) ──▶ Render (Go API) ──▶ SQLite or Neon Postgres
                              │
                              ▼
                    Neon Object Storage
```

## Commands

| Script | Description |
|--------|-------------|
| `pnpm dev` | Web + API, local disk + SQLite |
| `pnpm dev:supabase` | Web + API, Supabase Postgres + Supabase Storage (S3) |
| `pnpm infra:up` | MinIO + Postgres (docker, optional) |
| `pnpm dev:s3` | API with MinIO |
