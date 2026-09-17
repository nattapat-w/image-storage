const STORAGE_KEY = "drive.openFolder";

/** Open a folder after navigating to `/dashboard` (no query param). */
export function stashDriveOpenFolder(folderId: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, folderId);
  } catch {
    /* private mode / quota */
  }
}

export function consumeDriveOpenFolder(): string | undefined {
  try {
    const id = sessionStorage.getItem(STORAGE_KEY);
    if (id) sessionStorage.removeItem(STORAGE_KEY);
    return id ?? undefined;
  } catch {
    return undefined;
  }
}

export function readDriveFolderFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("folder") ?? undefined;
}

/** Remove `folder` from the address bar without a Next.js navigation. */
export function stripDriveFolderFromUrl() {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  if (!u.searchParams.has("folder")) return;
  u.searchParams.delete("folder");
  window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
}

/** Notification / external links may still use `/dashboard?folder=`. */
export function resolveInitialDriveFolderId(): string | undefined {
  return consumeDriveOpenFolder() ?? readDriveFolderFromUrl();
}
