# Neon Object Storage setup

[Neon Object Storage](https://neon.com/docs/storage/get-started) is S3-compatible, on the **free tier during beta**, and pairs well with Neon Postgres on the same branch.

Your Go API already supports it via `STORAGE_DRIVER=neon`.

## 1. Enable storage in Neon

1. Sign up at [neon.tech](https://neon.tech) (no credit card on free tier).
2. Create a project in **AWS US East (Ohio)** or **AWS Europe (Frankfurt)**.
3. **Recommended:** use `neon.ts` + `neon deploy` to create a bucket (see Neon docs).
4. Or create a bucket in the Neon Console / CLI:
   ```bash
   neon buckets create image-storage
   ```

## 2. Get branch endpoint + credentials

**Option A — `neon deploy` (easiest)**

After `neon deploy`, pull env vars:

```bash
neon env pull
```

You get `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

**Option B — Neon API**

```bash
# Branch storage info
curl "https://console.neon.tech/api/v2/projects/{project_id}/branches/{branch_id}/storage" \
  -H "Authorization: Bearer $NEON_API_KEY"

# Create credential (save keys immediately — shown once)
curl -X POST "https://console.neon.tech/api/v2/projects/{project_id}/branches/{branch_id}/credentials" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"scopes": ["storage:read", "storage:write"], "principal_type": "user"}'
```

- `AWS_ACCESS_KEY_ID` = `token_id` (`nak_live_...`)
- `AWS_SECRET_ACCESS_KEY` = `s3_secret_access_key` (`nsk_live_...`)

## 3. Render (Go API) environment

Use **either** Neon’s `AWS_*` names **or** our `S3_*` aliases:

```env
STORAGE_DRIVER=neon
S3_BUCKET=image-storage

# Neon names (from neon env pull)
AWS_ENDPOINT_URL_S3=https://br-xxxx.storage.c-2.us-east-2.aws.neon.tech
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=nak_live_...
AWS_SECRET_ACCESS_KEY=nsk_live_...

# Or equivalent S3_* names:
# S3_ENDPOINT=https://br-xxxx.storage.c-2.us-east-2.aws.neon.tech
# S3_REGION=us-east-2
# S3_ACCESS_KEY=nak_live_...
# S3_SECRET_KEY=nsk_live_...

JWT_SECRET=...
FRONTEND_URL=https://your-app.vercel.app
```

Optional — use **Neon Postgres** for metadata too:

```env
DATABASE_URL=postgres://...@.../neondb?sslmode=require
```

(SQLite adapter still default until Postgres repo is wired; you can keep SQLite on Render for now.)

Redeploy. Logs should show: `blob storage: neon`.

## 4. Vercel

No storage keys on Vercel — images still load through your API.

## 5. Local dev

Copy `apps/api/.env.neon.example` → `apps/api/.env`, fill values from `neon env pull`, then run the API.

Or keep `STORAGE_DRIVER=local` for everyday dev.

## Notes

- **Path-style URLs only** — handled automatically for `neon` driver.
- **Create bucket in Neon first** — the API only checks the bucket exists (`HeadBucket`), it does not create it.
- **Beta** — expect changes; fine for side projects and learning.
- **No credit card** on Neon free tier (unlike R2).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `bucket ... HeadBucket` failed | Bucket name mismatch, wrong branch endpoint, or invalid credentials |
| `404` on storage API | Object Storage not enabled for branch / wrong region |
| Upload OK locally, fails on Render | Env vars not set on Render or old deploy |
