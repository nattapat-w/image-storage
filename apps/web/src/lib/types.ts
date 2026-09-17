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
  isShareFolder?: boolean;
  imageCount: number;
  totalSize: number;
  createdAt: string;
  updatedAt: string;
};

export type FolderMember = {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: string;
  joinedAt: string;
};

export type FolderInvite = {
  id: string;
  folderId: string;
  email: string;
  inviteUrl: string;
  expiresAt: string;
  createdAt: string;
  accepted: boolean;
};

export type SharedFolderEntry = {
  folder: Folder;
  ownerId: string;
  ownerEmail?: string;
  role: string;
};

export type ShareFolderAccess = {
  members: FolderMember[];
  invites: FolderInvite[];
};

export type ShareFolderBrowse = {
  rootId: string;
  ownerId: string;
  folders: Folder[];
  images: ImageItem[];
};

export type ShareFolderContext =
  | { active: false }
  | { active: true; rootId: string; ownerId: string; role: string };

export type IncomingShareFolderInvite = {
  invite: FolderInvite;
  folder: Folder;
  ownerEmail?: string;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
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
  uploadedBy?: string;
  uploadedByDisplayName?: string;
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
  isShareFolder?: boolean;
};

export type Share = {
  id: string;
  resourceType: "image" | "folder";
  resourceId: string;
  token: string;
  url: string;
  expiresAt?: string | null;
  createdAt: string;
};

export type Breadcrumb = { id: string; name: string };

export type ShareView =
  | { type: "image"; image: ImageItem }
  | { type: "folder"; folders: Folder[]; images: ImageItem[] };

export type BrowseMode = "folder" | "favorites" | "timeline" | "trash";
