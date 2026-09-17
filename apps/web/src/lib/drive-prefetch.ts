const HOVER_MS = 200;

export type PrefetchRunner = () => Promise<void>;

export function createFolderPrefetchScheduler(hoverMs = HOVER_MS) {
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const inFlight = new Set<string>();

  function schedule(key: string, run: PrefetchRunner) {
    const pending = debounceTimers.get(key);
    if (pending) clearTimeout(pending);
    debounceTimers.set(
      key,
      setTimeout(() => {
        debounceTimers.delete(key);
        if (inFlight.has(key)) return;
        inFlight.add(key);
        void run()
          .catch(() => {
            /* prefetch is best-effort — 403/404 must not surface in UI */
          })
          .finally(() => {
            inFlight.delete(key);
          });
      }, hoverMs),
    );
  }

  function cancelAll() {
    for (const t of debounceTimers.values()) clearTimeout(t);
    debounceTimers.clear();
  }

  return { schedule, cancelAll };
}
