import { getToken } from "./auth-storage";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const MAX_ENTRIES = 80;

function evictOldest() {
  if (cache.size < MAX_ENTRIES) return;
  const oldest = cache.keys().next().value;
  if (!oldest) return;
  const url = cache.get(oldest);
  if (url) URL.revokeObjectURL(url);
  cache.delete(oldest);
}

export function getCachedBlobUrl(src: string): string | undefined {
  return cache.get(src);
}

export function prefetchImageBlob(src: string): void {
  if (cache.has(src) || inflight.has(src)) return;
  fetchImageBlobUrl(src).catch(() => {});
}

export async function fetchImageBlobUrl(src: string): Promise<string> {
  const hit = cache.get(src);
  if (hit) return hit;

  const pending = inflight.get(src);
  if (pending) return pending;

  const token = getToken();
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  const promise = fetch(src, { headers })
    .then((r) => {
      if (!r.ok) throw new Error("load failed");
      return r.blob();
    })
    .then((blob) => {
      evictOldest();
      const url = URL.createObjectURL(blob);
      cache.set(src, url);
      inflight.delete(src);
      return url;
    })
    .catch((err) => {
      inflight.delete(src);
      throw err;
    });

  inflight.set(src, promise);
  return promise;
}
