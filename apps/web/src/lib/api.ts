import type {
  Breadcrumb,
  Folder,
  FolderOption,
  ImageItem,
  Share,
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
  deleteImage(id: string) {
    return request<void>(`/api/images/${id}`, { method: "DELETE" });
  },
  restoreImage(id: string) {
    return request<ImageItem>(`/api/images/${id}/restore`, { method: "POST" });
  },
  deleteImagePermanent(id: string) {
    return request<void>(`/api/images/${id}/permanent`, { method: "DELETE" });
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
  publicImageUrl(id: string) {
    return `/api/public/images/${id}/file`;
  },
  createShare(resourceType: "image" | "folder", resourceId: string) {
    return request<Share>("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceType, resourceId }),
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
};

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
