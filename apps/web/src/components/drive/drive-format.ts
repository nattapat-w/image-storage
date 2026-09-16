import { formatBytes } from "@/lib/api";
import type { Folder as FolderType, FolderOption } from "@/lib/types";

export function folderStatsLabel(count: number, size: number) {
  const photos = count === 1 ? "1 photo" : `${count} photos`;
  return `${photos} · ${formatBytes(size)}`;
}

export function folderOptionToFolderType(f: FolderOption): FolderType {
  return {
    id: f.id,
    parentId: null,
    name: f.name,
    imageCount: f.imageCount,
    totalSize: f.totalSize,
    createdAt: "",
    updatedAt: "",
  };
}

export function formatDriveDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
