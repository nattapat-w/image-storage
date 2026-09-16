# Ollama auto-tag (local)

## Quick start

```powershell
pnpm ollama:up
pnpm ollama:setup
```

Set in `apps/api/.env.supabase` (or `.env.local`):

```env
IMAGE_CLASSIFIER=ollama
OLLAMA_URL=http://127.0.0.1:11435
OLLAMA_MODEL=phototagger
AUTO_TAG_ON_UPLOAD=true
```

## GPU (much faster)

CPU tagging can take 30–120+ seconds per image. GPU is often **5–15 seconds**.

### Windows (Docker Desktop)

1. NVIDIA GPU + latest driver
2. Docker Desktop → Settings → enable **WSL2** and **GPU support**
3. Start Ollama with GPU compose:

```powershell
pnpm ollama:gpu:up
pnpm ollama:setup
```

4. Verify GPU on the **host** (the Ollama image does not include `nvidia-smi`):

```powershell
nvidia-smi
```

Upload an image to trigger tagging, then run `nvidia-smi` again — you should see GPU memory/util increase. If not, the container is still on CPU.

### Keep model loaded (faster repeat tags)

```powershell
docker compose exec ollama ollama run phototagger "ready"
```

First request loads the model (~10–30s); later requests are faster while the container stays up.

## Monitoring

While tagging, the API exposes job state:

```http
GET /api/autotag/status?ids=<image-id>
```

Response:

```json
{
  "jobs": [
    {
      "imageId": "...",
      "state": "running",
      "startedAt": "2026-09-16T10:00:00Z",
      "elapsedSec": 23
    }
  ]
}
```

States: `running` → `done` or `failed`.

## Port note

Docker Ollama uses host port **11435** because Ollama Desktop often binds **11434** on Windows.
