import type { Sort } from "@/components/drive/constants";
import { formatBytes } from "@/lib/api";
import type { Breadcrumb, Folder as FolderType, FolderOption, ImageItem, TimelineGroup } from "@/lib/types";

export function compareImagesForSort(a: ImageItem, b: ImageItem, sort: Sort): number {
  switch (sort) {
    case "date":
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    case "size":
      return b.size - a.size;
    default:
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  }
}

export function insertImageSorted(prev: ImageItem[], img: ImageItem, sort: Sort): ImageItem[] {
  if (prev.some((item) => item.id === img.id)) return prev;
  return [...prev, img].sort((a, b) => compareImagesForSort(a, b, sort));
}

export function timelinePeriodForImage(img: ImageItem): string {
  const src = img.takenAt || img.createdAt;
  if (src.length >= 7) return src.slice(0, 7);
  return "unknown";
}

export function timelineLabelForPeriod(period: string): string {
  if (period === "unknown") return "Unknown date";
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function insertImageIntoTimelineGroups(
  groups: TimelineGroup[],
  img: ImageItem,
): TimelineGroup[] {
  const period = timelinePeriodForImage(img);
  const label = timelineLabelForPeriod(period);
  const groupIdx = groups.findIndex((g) => g.period === period);
  if (groupIdx === -1) {
    return [...groups, { period, label, images: [img] }].sort((a, b) =>
      b.period.localeCompare(a.period),
    );
  }
  if (groups[groupIdx].images.some((item) => item.id === img.id)) return groups;
  const images = [...groups[groupIdx].images, img].sort((a, b) => {
    const aDate = a.takenAt || a.createdAt;
    const bDate = b.takenAt || b.createdAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
  return groups.map((g, idx) => (idx === groupIdx ? { ...g, images } : g));
}

export function folderStatsLabel(count: number, size: number) {
  const photos = count === 1 ? "1 photo" : `${count} photos`;
  return `${photos} · ${formatBytes(size)}`;
}

export function buildBreadcrumbFromAllFolders(
  folderId: string | undefined,
  allFolders: FolderOption[],
): Breadcrumb[] {
  if (!folderId) return [];
  const target = allFolders.find((f) => f.id === folderId);
  if (!target) return [];

  const segments = target.path.split(" / ").filter(Boolean);
  const crumbs: Breadcrumb[] = [];
  for (let i = 0; i < segments.length; i++) {
    const partialPath = segments.slice(0, i + 1).join(" / ");
    const match = allFolders.find((f) => f.path === partialPath);
    if (match) crumbs.push({ id: match.id, name: match.name });
  }
  return crumbs.length ? crumbs : [{ id: folderId, name: target.name }];
}

export function folderOptionToFolderType(f: FolderOption): FolderType {
  return {
    id: f.id,
    parentId: null,
    name: f.name,
    isShareFolder: f.isShareFolder,
    imageCount: f.imageCount,
    totalSize: f.totalSize,
    createdAt: "",
    updatedAt: "",
  };
}

export function imagePosterLabel(img: ImageItem, fallback: string): string {
  const name = img.uploadedByDisplayName?.trim();
  if (name) return name;
  return fallback;
}

export function formatDriveDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
