# Infrastructure

Modular monolith: one Go API, pluggable storage adapters.

## Blob storage

| Driver | Use case |
|--------|----------|
| `local` (default) | Solo dev, no cloud |
| `neon` | **Recommended** — Neon Object Storage (S3 API, free beta, no credit card) |
| `r2` | Cloudflare R2 (requires card/PayPal) |
| `s3` | MinIO local dev, AWS S3 |

**Neon setup:** [neon-storage-setup.md](./neon-storage-setup.md)

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
| **SQLite** | Default — `DATABASE_PATH` |
| **Neon Postgres** | Set `DATABASE_URL` on Render (API Postgres adapter coming later) |

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
| `pnpm infra:up` | MinIO + Postgres (docker, optional) |
| `pnpm dev:s3` | API with MinIO |
