export type User = {
  id: string;
  email: string;
  displayName?: string;
  autoTagEnabled?: boolean;
  createdAt?: string;
};

export type Folder = {
  id: string;
  parentId: string | null;
  name: string;
  imageCount: number;
  totalSize: number;
  createdAt: string;
  updatedAt: string;
};

export type AutoTagJob = {
  imageId: string;
  state: "running" | "done" | "failed";
  startedAt: string;
  elapsedSec: number;
  error?: string;
};

export type ImageItem = {
  id: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  size: number;
  visibility: "private" | "public";
  favorite: boolean;
  contentHash?: string;
  takenAt: string | null;
  deletedAt?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type Tag = {
  id: string;
  name: string;
  imageCount: number;
};

export type TimelineGroup = {
  period: string;
  label: string;
  images: ImageItem[];
};

export type FolderOption = {
  id: string;
  name: string;
  path: string;
  imageCount: number;
  totalSize: number;
};

export type Share = {
  id: string;
  resourceType: "image" | "folder";
  resourceId: string;
  token: string;
  url: string;
  createdAt: string;
};

export type Breadcrumb = { id: string; name: string };

export type ShareView =
  | { type: "image"; image: ImageItem }
  | { type: "folder"; folders: Folder[]; images: ImageItem[] };

export type BrowseMode = "folder" | "favorites" | "timeline" | "trash";
