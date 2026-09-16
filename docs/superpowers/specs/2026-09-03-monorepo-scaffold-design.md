# Monorepo scaffold design (Next + Go)

Date: 2026-09-03  
Status: approved in conversation; awaiting spec review  
Scope: empty runnable scaffold only. No image-storage features, auth, DB, shared packages, Turbo, Docker, or CI.

## Goal

Stand up a pnpm monorepo so `pnpm dev` starts Next.js and a Go API, and the Next home page can reach the API through a same-origin rewrite.

Success: open `http://localhost:3000`, see a live `GET /api/health` response from Go.

## Architecture

```
browser :3000
    ↓  /          Next (apps/web)
    ↓  /api/*     Next rewrite → Go :8080
Go chi (apps/api)
```

Existing root `package.json` and `pnpm-workspace.yaml` (`apps/*`, `packages/*`) stay. No new workspace tool.

| Piece | Role | How to run | Depends on |
|---|---|---|---|
| `apps/web` | Next App Router + TypeScript + Tailwind | `pnpm --filter web dev` | rewrite → Go |
| `apps/api` | Go HTTP API | `go run ./cmd/server` | chi, env `PORT` / `HOST` |
| root `package.json` | orchestrate | `pnpm dev` | concurrently + both apps |
| `packages/` | empty placeholder | later shared code | none |

Go listens on `127.0.0.1` only in local dev. The browser never talks to `:8080` directly.

## Layout

```
image-storage/
  package.json
  pnpm-workspace.yaml
  .gitignore
  README.md
  apps/
    web/                 Next app (name: web)
    api/
      go.mod             module path: image-storage/apps/api
      cmd/server/main.go
      internal/server/   chi router + middleware
      internal/health/   GET /api/health
  packages/              empty, keep workspace glob
  docs/superpowers/specs/
```

## Next (`apps/web`)

- Scaffold with current `create-next-app`: App Router, TypeScript, Tailwind, ESLint, `src/` if the generator default uses it.
- `next.config` rewrite: `/api/:path*` → `http://127.0.0.1:8080/api/:path*`.
- Home page (`/`) fetches `/api/health` on the client. Success: show the JSON. Failure (Go down, network): show `API unreachable`. Do not crash the page.
- Next does not rewrite error bodies. Proxy status and JSON through as-is.

## Go (`apps/api`)

- Module at `apps/api` (not a root `go.mod`).
- HTTP stack: [chi](https://github.com/go-chi/chi) v5.
- Entry: `cmd/server/main.go` reads `HOST` (default `127.0.0.1`) and `PORT` (default `8080`), binds, exits 1 with a clear message if bind fails (including port in use).
- Router lives in `internal/server`: request id, recover, request log (method, path, status, duration, request id).
- `GET /api/health` in `internal/health` returns `200` and:

```json
{ "ok": true, "service": "api", "time": "<RFC3339>" }
```

- Unknown path: `404` JSON `{ "error": "..." }`.
- Panic: Recoverer returns `500` JSON `{ "error": "..." }` and keeps the process up.

## Root scripts

| Script | Action |
|---|---|
| `dev` | start web + api together (concurrently) |
| `dev:web` | Next only |
| `dev:api` | Go only (`go run ./cmd/server` in `apps/api`) |
| `build` | `next build` + `go build` |
| `test` | Go tests (`go test ./...` in `apps/api`) |

`concurrently` is a root `devDependency`. Web is a normal pnpm workspace package. Go is not a Node package; root scripts `cd` / run in `apps/api`.

## Data flow

1. `pnpm dev` starts `next dev` on `:3000` and `go run` on `127.0.0.1:8080`.
2. Browser `GET /api/health` hits Next.
3. Next rewrite forwards to `http://127.0.0.1:8080/api/health`.
4. chi → health handler → JSON → Next → browser.

No CORS. No `API_URL` in the browser. Future API routes stay under `/api/*` so the same rewrite applies.

## Error handling

- Go recover + JSON 404/500 as above.
- Bind/port failure: process exit 1, no silent hang.
- Home page treats any non-OK fetch as `API unreachable`.

## Testing

- Go: `internal/health` httptest — `GET /api/health` → 200, `ok: true`.
- No Next unit/e2e in this scaffold.
- No CI.

Manual check: `pnpm dev` → open `/` → health JSON visible.

## Out of scope

Image upload/list, auth, database, OpenAPI/shared types, Turbo, Docker, remote bind, production deploy, GitHub/GitLab CI.

## Tooling notes

- Package manager: pnpm (already pinned in root `devEngines`).
- Init git is a separate step; this repo had no `.git` when the spec was written.
