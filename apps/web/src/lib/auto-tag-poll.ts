import type { AutoTagJob, ImageItem } from "./types";

const STORAGE_KEY = "image-storage:pending-auto-tags";
const PENDING_MAX_AGE_MS = 15 * 60 * 1000;

type PendingEntry = {
  id: string;
  startedAt: number;
};

export function hasAutoTags(tags: string[]) {
  return tags.length > 0;
}

export function liveAutoTagElapsed(job: AutoTagJob | undefined) {
  if (!job) return 0;
  if (job.state !== "running") return job.elapsedSec;
  const started = Date.parse(job.startedAt);
  if (!Number.isFinite(started)) return job.elapsedSec;
  return Math.max(0, Math.floor((Date.now() - started) / 1000));
}

function readPendingEntries(): PendingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingEntry[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - PENDING_MAX_AGE_MS;
    return parsed.filter((entry) => entry?.id && entry.startedAt >= cutoff);
  } catch {
    return [];
  }
}

function writePendingEntries(entries: PendingEntry[]) {
  if (typeof window === "undefined") return;
  if (!entries.length) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function loadPendingAutoTagIds(): string[] {
  return readPendingEntries().map((entry) => entry.id);
}

export function addPendingAutoTagIds(ids: string[]) {
  if (!ids.length) return;
  const now = Date.now();
  const byId = new Map(readPendingEntries().map((entry) => [entry.id, entry]));
  for (const id of ids) {
    if (!byId.has(id)) {
      byId.set(id, { id, startedAt: now });
    }
  }
  writePendingEntries([...byId.values()]);
}

export function removePendingAutoTagId(id: string) {
  writePendingEntries(readPendingEntries().filter((entry) => entry.id !== id));
}

export function clearPendingAutoTagIds() {
  writePendingEntries([]);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type WatchOptions = {
  intervalMs?: number;
  timeoutMs?: number;
};

export type AutoTagWatchResult = {
  tagged: number;
  failed: number;
  timedOut: number;
};

export async function watchAutoTagJobs(
  imageIds: string[],
  getStatus: (ids: string[]) => Promise<AutoTagJob[]>,
  getImage: (id: string) => Promise<ImageItem>,
  handlers: {
    onStatus: (jobs: AutoTagJob[]) => void;
    onTagged: (img: ImageItem) => void;
    onFailed: (job: AutoTagJob) => void;
  },
  options: WatchOptions = {},
): Promise<AutoTagWatchResult> {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const pending = new Set(imageIds);
  const deadline = Date.now() + timeoutMs;
  let tagged = 0;
  let failed = 0;

  async function tick() {
    const ids = [...pending];
    if (!ids.length) return;

    const jobs = await getStatus(ids);
    handlers.onStatus(jobs);
    const jobById = new Map(jobs.map((job) => [job.imageId, job]));

    for (const id of ids) {
      const job = jobById.get(id);
      if (job) {
        if (job.state === "running") continue;
        pending.delete(id);
        if (job.state === "done") {
          tagged += 1;
          try {
            handlers.onTagged(await getImage(id));
          } catch {
            /* list refresh may already include tags */
          }
        } else {
          failed += 1;
          handlers.onFailed(job);
        }
        continue;
      }

      try {
        const img = await getImage(id);
        if (hasAutoTags(img.tags)) {
          pending.delete(id);
          tagged += 1;
          handlers.onTagged(img);
        }
      } catch {
        /* keep waiting */
      }
    }
  }

  await tick();
  while (pending.size > 0 && Date.now() < deadline) {
    await sleep(intervalMs);
    await tick();
  }

  return { tagged, failed, timedOut: pending.size };
}
