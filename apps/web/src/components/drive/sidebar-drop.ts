import type { FolderOption } from "@/lib/types";
import { SIDEBAR_BASE_PX, SIDEBAR_INDENT_PX, sidebarDropPosition } from "@/lib/folder-tree";

export type SidebarDropPosition = "before" | "inside" | "after";

export type SidebarDropHint =
  | { targetId: string; position: SidebarDropPosition; depth: number }
  | { targetId: "root"; position: "inside" };

function dropDepthFromEvent(e: React.DragEvent, sidebarLeft: number, maxDepth: number): number {
  const x = e.clientX - sidebarLeft;
  const raw = Math.round((x - SIDEBAR_BASE_PX) / SIDEBAR_INDENT_PX);
  return Math.max(0, Math.min(maxDepth, raw));
}

function parentFolderId(folder: FolderOption, all: FolderOption[]): string | null {
  const parts = folder.path.split(" / ");
  if (parts.length <= 1) return null;
  const parentPath = parts.slice(0, -1).join(" / ");
  return all.find((x) => x.path === parentPath)?.id ?? null;
}

function parentIdAtDepth(folder: FolderOption, depth: number, all: FolderOption[]): string | null {
  if (depth <= 0) return null;
  const parts = folder.path.split(" / ");
  if (depth >= parts.length) return parentFolderId(folder, all);
  const parentPath = parts.slice(0, depth).join(" / ");
  return all.find((x) => x.path === parentPath)?.id ?? null;
}

function resolveSidebarDropDepth(
  folder: FolderOption,
  position: SidebarDropPosition,
  e: React.DragEvent,
  sidebarLeft: number,
): number {
  const parts = folder.path.split(" / ");
  const folderDepth = parts.length - 1;
  const depthFromX = dropDepthFromEvent(e, sidebarLeft, folderDepth + 1);

  if (position === "inside") return folderDepth + 1;

  if (position === "after") {
    const outdentDepth = Math.max(0, parts.length - 2);
    return Math.min(depthFromX, outdentDepth);
  }

  const siblingDepth = Math.max(0, parts.length - 1);
  return Math.min(depthFromX, siblingDepth);
}

/** Parent folder id for a sidebar drop (images + folder reparent). */
export function parentIdFromSidebarHint(hint: SidebarDropHint, all: FolderOption[]): string | null {
  if (hint.targetId === "root") return null;
  const folder = all.find((x) => x.id === hint.targetId);
  if (!folder) return null;
  if (hint.position === "inside") return hint.targetId;
  return parentIdAtDepth(folder, hint.depth, all);
}

export function sidebarHintFromEvent(
  folder: FolderOption,
  e: React.DragEvent,
  sidebarLeft: number,
): { targetId: string; position: SidebarDropPosition; depth: number } {
  const position = sidebarDropPosition(e);
  const depth = resolveSidebarDropDepth(folder, position, e, sidebarLeft);
  return { targetId: folder.id, position, depth };
}
