# Cloudflare R2 setup (Render + Vercel)

Use R2 for image bytes. Metadata stays in SQLite/Postgres on Render. No AWS account needed.

## 1. Create R2 bucket (Cloudflare)

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) (free account).
2. **R2** → **Create bucket** → name e.g. `image-storage`.
3. **R2** → **Manage R2 API tokens** → **Create API token**.
   - Permission: **Object Read & Write**
   - Scope: this bucket only (recommended)
4. Save:
   - **Access Key ID** → `S3_ACCESS_KEY`
   - **Secret Access Key** → `S3_SECRET_KEY`
5. Note your **Account ID** (R2 overview page).

**S3 API endpoint** (replace `ACCOUNT_ID`):

```
https://ACCOUNT_ID.r2.cloudflarestorage.com
```

## 2. Render (Go API)

In your Render web service → **Environment**:

| Key | Value |
|-----|--------|
| `STORAGE_DRIVER` | `r2` |
| `S3_ENDPOINT` | `https://ACCOUNT_ID.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `image-storage` |
| `S3_ACCESS_KEY` | *(from R2 token)* |
| `S3_SECRET_KEY` | *(from R2 token)* |
| `JWT_SECRET` | *(long random string)* |
| `FRONTEND_URL` | `https://your-app.vercel.app` |

`STORAGE_DRIVER=r2` is an alias — same S3 adapter, R2 defaults applied.

Redeploy API. Logs should show: `blob storage driver: s3`.

## 3. Vercel (Next.js)

No R2 keys on Vercel — the **browser never talks to R2 directly**. Images load via your API (`/api/images/.../file` proxied to Render).

Set in Vercel only if you use env for API URL (already via `next.config` rewrite to Render).

## 4. Local dev

**Option A — local disk (default)**

```bash
pnpm dev
```

**Option B — same R2 bucket as prod** (careful: writes go to real bucket)

Copy `apps/api/.env.r2.example` → `apps/api/.env` and fill credentials.

```bash
pnpm dev:api   # or full pnpm dev with .env loaded
```

**Option C — MinIO offline**

```bash
pnpm infra:up && pnpm dev:s3
```

## 5. Optional: public CDN URL

R2 can expose a **custom domain** (Cloudflare CDN). This app still serves private images through the API with JWT. Public images use `/api/public/images/{id}/file`. Wiring direct R2/CDN URLs is a future enhancement (presigned URLs).

## Troubleshooting

| Error | Fix |
|-------|-----|
| `bucket ... HeadBucket` failed | Wrong bucket name, token scope, or endpoint account ID |
| `S3_ACCESS_KEY ... required` | Set keys on Render; don't rely on MinIO defaults |
| Upload works locally, not on Render | Check env vars on Render, redeploy after change |
| Old images missing after switch | Local files aren't auto-migrated — re-upload or run a migration script |

## Env reference

```env
STORAGE_DRIVER=r2
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=image-storage
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

Equivalent:

```env
STORAGE_DRIVER=s3
S3_SKIP_BUCKET_CREATE=true
S3_USE_PATH_STYLE=true
# ... same endpoint, region, bucket, keys
```
