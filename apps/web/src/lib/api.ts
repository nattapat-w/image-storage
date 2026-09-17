import type {
  AutoTagJob,
  Breadcrumb,
  Folder,
  FolderInvite,
  FolderOption,
  ImageItem,
  Share,
  ShareFolderAccess,
  ShareFolderBrowse,
  ShareFolderContext,
  AppNotification,
  IncomingShareFolderInvite,
  SharedFolderEntry,
  ShareView,
  Tag,
  TimelineGroup,
  User,
} from "./types";
import { getToken, setToken } from "./auth-storage";

export {
  getToken,
  setToken,
  getRememberMe,
  setRememberMe,
  getLastEmail,
  setLastEmail,
  clearRememberedLogin,
} from "./auth-storage";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

export function apiErrorMessage(err: unknown, fallback = "Something went wrong") {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function isUnauthorizedError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export function isForbiddenError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}

export function isNotFoundError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/** Expected for hover prefetch / stale navigation — no user-facing toast. */
export function isSilentBrowseError(err: unknown): boolean {
  return (
    isUnauthorizedError(err) ||
    isForbiddenError(err) ||
    isNotFoundError(err)
  );
}

/** Best-effort fetch; returns null instead of throwing (prefetch only). */
export async function tryRequest<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T | null> {
  try {
    return await request<T>(path, options, auth);
  } catch {
    return null;
  }
}

/** Fired when an authenticated API call returns 401 (session cleared). */
export const AUTH_SESSION_EXPIRED = "auth:session-expired";

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    let msg = res.statusText;
    let body: unknown;
    try {
      body = await res.json();
      if (typeof body === "object" && body && "error" in body) {
        const err = body as { error: string; message?: string };
        msg = err.message ?? err.error;
      }
    } catch {
      /* ignore */
    }
    if (res.status === 401 && auth) {
      setToken(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED));
      }
      msg = "Session expired — please sign in again.";
    }
    throw new ApiError(res.status, msg, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type ImageListOptions = {
  folderId?: string;
  sort?: string;
  favorite?: boolean;
  tag?: string;
  trash?: boolean;
};

export const api = {
  register(email: string, password: string) {
    return request<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }, false).then((res) => {
      setToken(res.token, true);
      return res;
    });
  },
  login(email: string, password: string, remember = true) {
    return request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }, false).then((res) => {
      setToken(res.token, remember);
      return res;
    });
  },
  me() {
    return request<User>("/api/auth/me");
  },
  updateProfile(data: { email: string; displayName: string }) {
    return request<User>("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  updateAutoTagEnabled(enabled: boolean) {
    return request<User>("/api/auth/me/auto-tag", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  },
  changePassword(currentPassword: string, newPassword: string) {
    return request<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
  forgotPassword(email: string) {
    return request<{ message: string; resetUrl?: string }>("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }, false);
  },
  resetPassword(token: string, newPassword: string) {
    return request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    }, false);
  },
  deleteAccount(password: string) {
    return request<void>("/api/auth/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
  },
  listFolders(parentId?: string) {
    const q = parentId ? `?parentId=${parentId}` : "";
    return request<Folder[]>(`/api/folders${q}`);
  },
  createFolder(name: string, parentId?: string) {
    return request<Folder>("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: parentId ?? null }),
    });
  },
  updateFolder(id: string, data: { name?: string; parentId?: string | null }) {
    return request<Folder>(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  deleteFolder(id: string) {
    return request<void>(`/api/folders/${id}`, { method: "DELETE" });
  },
  breadcrumb(folderId?: string) {
    const q = folderId ? `?folderId=${folderId}` : "";
    return request<Breadcrumb[]>(`/api/folders/breadcrumb${q}`);
  },
  listAllFolders() {
    return request<FolderOption[]>("/api/folders/all");
  },
  listImages(opts: ImageListOptions = {}) {
    const params = new URLSearchParams();
    if (opts.sort) params.set("sort", opts.sort);
    if (opts.folderId) params.set("folderId", opts.folderId);
    if (opts.favorite) params.set("favorite", "1");
    if (opts.tag) params.set("tag", opts.tag);
    if (opts.trash) params.set("trash", "1");
    const q = params.toString();
    return request<ImageItem[]>(`/api/images${q ? `?${q}` : ""}`);
  },
  listTimeline() {
    return request<TimelineGroup[]>("/api/images/timeline");
  },
  listTags() {
    return request<Tag[]>("/api/tags");
  },
  setImageTags(id: string, tags: string[]) {
    return request<ImageItem>(`/api/images/${id}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
  },
  getImage(id: string) {
    return request<ImageItem>(`/api/images/${id}`);
  },
  getAutoTagStatus(ids?: string[]) {
    const query =
      ids?.length ? `?ids=${encodeURIComponent(ids.join(","))}` : "";
    return request<{ jobs: AutoTagJob[] }>(`/api/autotag/status${query}`);
  },
  uploadImage(file: File, folderId?: string) {
    const form = new FormData();
    form.append("file", file);
    if (folderId) form.append("folderId", folderId);
    return request<ImageItem>("/api/images", { method: "POST", body: form });
  },
  updateImage(
    id: string,
    data: {
      name?: string;
      folderId?: string | null;
      visibility?: string;
      favorite?: boolean;
    },
  ) {
    return request<ImageItem>(`/api/images/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  copyImage(id: string, folderId: string) {
    return request<ImageItem>(`/api/images/${id}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
  },
  deleteImage(id: string) {
    return request<void>(`/api/images/${id}`, { method: "DELETE" });
  },
  restoreImage(id: string) {
    return request<ImageItem>(`/api/images/${id}/restore`, { method: "POST" });
  },
  deleteImagePermanent(id: string) {
    return request<void>(`/api/images/${id}/permanent`, { method: "DELETE" });
  },
  emptyTrash() {
    return request<{ deleted: number }>("/api/trash", { method: "DELETE" });
  },
  deleteAllImages() {
    return request<{ deleted: number; foldersDeleted: number }>("/api/dev/images", {
      method: "DELETE",
    });
  },
  imageFileUrl(id: string, token?: string) {
    if (token) return `/api/share/${token}/images/${id}/file`;
    return `/api/images/${id}/file`;
  },
  imageCdnUrl(id: string, token?: string) {
    if (token) return `/api/share/${token}/images/${id}/url`;
    return `/api/images/${id}/url`;
  },
  publicImageUrl(id: string) {
    return `/api/public/images/${id}/file`;
  },
  publicImageCdnUrl(id: string) {
    return `/api/public/images/${id}/url`;
  },
  imageViewPath(id: string) {
    return `/image/${id}`;
  },
  createShare(
    resourceType: "image" | "folder",
    resourceId: string,
    expiresAt?: string | null,
  ) {
    const body: { resourceType: string; resourceId: string; expiresAt?: string } = {
      resourceType,
      resourceId,
    };
    if (expiresAt) body.expiresAt = expiresAt;
    return request<Share>("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  listShares(resourceType: string, resourceId: string) {
    return request<Share[]>(
      `/api/shares?resourceType=${resourceType}&resourceId=${resourceId}`,
    );
  },
  deleteShare(id: string) {
    return request<void>(`/api/shares/${id}`, { method: "DELETE" });
  },
  viewShare(token: string) {
    return request<ShareView>(`/api/share/${token}`, {}, false);
  },
  enableShareFolder(folderId: string) {
    return request<Folder>(`/api/folders/${folderId}/sharing`, { method: "POST" });
  },
  disableShareFolder(folderId: string) {
    return request<void>(`/api/folders/${folderId}/sharing`, { method: "DELETE" });
  },
  getShareFolderAccess(folderId: string) {
    return request<ShareFolderAccess>(`/api/folders/${folderId}/members`);
  },
  inviteShareFolderMember(folderId: string, email: string) {
    return request<FolderInvite>(`/api/folders/${folderId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  },
  removeShareFolderMember(folderId: string, userId: string) {
    return request<void>(`/api/folders/${folderId}/members/${userId}`, { method: "DELETE" });
  },
  previewShareFolderInvite(token: string) {
    return request<{ invite: FolderInvite; folder: Folder }>(
      `/api/share-folder/invites/${token}`,
      {},
      false,
    );
  },
  acceptShareFolderInvite(token: string) {
    return request<SharedFolderEntry>(`/api/share-folder/invites/${token}/accept`, {
      method: "POST",
    });
  },
  resolveShareFolderContext(folderId: string) {
    return request<ShareFolderContext>(
      `/api/share-folder/context?folderId=${encodeURIComponent(folderId)}`,
    );
  },
  listSharedFolders() {
    return request<SharedFolderEntry[]>("/api/share-folder/folders");
  },
  listIncomingShareFolderInvites() {
    return request<IncomingShareFolderInvite[]>("/api/share-folder/my-invites");
  },
  listNotifications() {
    return request<AppNotification[]>("/api/notifications");
  },
  markNotificationRead(id: string) {
    return request<void>(`/api/notifications/${id}/read`, { method: "POST" });
  },
  markAllNotificationsRead() {
    return request<void>("/api/notifications/read-all", { method: "POST" });
  },
  listShareFolderTree(rootId: string) {
    return request<FolderOption[]>(`/api/share-folder/folders/${rootId}/all`);
  },
  shareFolderBreadcrumb(rootId: string, folderId?: string) {
    const q = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
    return request<Breadcrumb[]>(`/api/share-folder/folders/${rootId}/breadcrumb${q}`);
  },
  browseSharedFolder(rootId: string, parentId?: string) {
    const q = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
    return request<ShareFolderBrowse>(`/api/share-folder/folders/${rootId}/browse${q}`);
  },
  uploadShareFolderImage(rootId: string, file: File, folderId?: string) {
    const form = new FormData();
    form.append("file", file);
    if (folderId) form.append("folderId", folderId);
    return request<ImageItem>(`/api/share-folder/folders/${rootId}/images`, {
      method: "POST",
      body: form,
    });
  },
  createShareFolderSubfolder(rootId: string, name: string, parentId?: string) {
    return request<Folder>(`/api/share-folder/folders/${rootId}/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: parentId ?? "" }),
    });
  },
  deleteShareFolderImage(imageId: string) {
    return request<void>(`/api/share-folder/images/${imageId}`, { method: "DELETE" });
  },
  copyShareFolderImage(imageId: string, folderId: string) {
    return request<ImageItem>(`/api/share-folder/images/${imageId}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
  },
  shareFolderImageFileUrl(imageId: string) {
    return `/api/share-folder/images/${imageId}/file`;
  },
  async downloadShareFolderZip(folderId: string) {
    const token = getToken();
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`/api/folders/${folderId}/download`, { headers });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const body = await res.json();
        if (typeof body === "object" && body && "error" in body) {
          const err = body as { error: string; message?: string };
          msg = err.message ?? err.error;
        }
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, msg);
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="([^"]+)"/i.exec(disposition);
    const filename = match?.[1] ?? "folder.zip";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
