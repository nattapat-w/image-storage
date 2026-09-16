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
    .then(async (r) => {
      if (!r.ok) throw new Error("load failed");
      const buf = await r.arrayBuffer();
      const headerType = r.headers.get("Content-Type")?.split(";")[0]?.trim();
      const type =
        headerType && headerType.startsWith("image/")
          ? headerType
          : sniffImageMime(buf) ?? "image/jpeg";
      return new Blob([buf], { type });
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

function sniffImageMime(buf: ArrayBuffer): string | undefined {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57 && b[9] === 0x45) {
    return "image/webp";
  }
  return undefined;
}
