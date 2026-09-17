/** Map API href (often full FRONTEND_URL) to an in-app path. */
export function notificationAppPath(href: string): string {
  if (href.startsWith("/")) return href;
  try {
    const u = new URL(href);
    return u.pathname + u.search + u.hash;
  } catch {
    return href;
  }
}
