import type { FolderOption } from "./types";

export const SIDEBAR_INDENT_PX = 12;
export const SIDEBAR_BASE_PX = 20;

/** Max folder path depth (root child = 1 level). */
export const MAX_FOLDER_NESTING = 4;

export function folderPathLevel(folder: FolderOption): number {
  return folder.path.split(" / ").length;
}

export function subtreePathLevels(folder: FolderOption, all: FolderOption[]): number {
  const prefix = `${folder.path} / `;
  let max = folderPathLevel(folder);
  for (const f of all) {
    if (f.id === folder.id || f.path.startsWith(prefix)) {
      max = Math.max(max, folderPathLevel(f));
    }
  }
  return max;
}

export function wouldExceedFolderNesting(
  targetParentId: string | null,
  all: FolderOption[],
  subtreeRoot: FolderOption,
): boolean {
  let parentLevel = 0;
  if (targetParentId !== null) {
    const parent = all.find((f) => f.id === targetParentId);
    if (!parent) return true;
    parentLevel = folderPathLevel(parent);
  }
  const span = subtreePathLevels(subtreeRoot, all) - folderPathLevel(subtreeRoot) + 1;
  return parentLevel + span > MAX_FOLDER_NESTING;
}

export function canCreateFolderIn(parentId: string | undefined, all: FolderOption[]): boolean {
  if (!parentId) return true;
  const parent = all.find((f) => f.id === parentId);
  if (!parent) return true;
  return folderPathLevel(parent) < MAX_FOLDER_NESTING;
}

export type SidebarDropPosition = "before" | "inside" | "after";

export type SidebarDropHint =
  | { targetId: string; position: SidebarDropPosition; depth: number }
  | { targetId: "root"; position: "inside" };

function parentIdFromPath(folder: FolderOption, all: FolderOption[]): string | null {
  const parts = folder.path.split(" / ");
  if (parts.length <= 1) return null;
  const parentPath = parts.slice(0, -1).join(" / ");
  return all.find((f) => f.path === parentPath)?.id ?? null;
}

export function folderDepth(folder: FolderOption): number {
  return Math.max(0, folder.path.split(" / ").length - 1);
}

export function flattenFolderTree(
  folders: FolderOption[],
  excludeId?: string,
): FolderOption[] {
  const byParent = new Map<string | null, FolderOption[]>();
  for (const f of folders) {
    if (f.id === excludeId) continue;
    const key = parentIdFromPath(f, folders);
    const list = byParent.get(key) ?? [];
    list.push(f);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  const out: FolderOption[] = [];
  function walk(parentId: string | null) {
    for (const f of byParent.get(parentId) ?? []) {
      out.push(f);
      walk(f.id);
    }
  }
  walk(null);
  return out;
}

export function sidebarDropPosition(e: React.DragEvent): SidebarDropPosition {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = (e.clientY - rect.top) / Math.max(rect.height, 1);
  if (ratio < 0.28) return "before";
  if (ratio > 0.72) return "after";
  return "inside";
}

export function dropDepthFromX(
  clientX: number,
  sidebarLeft: number,
  maxDepth: number,
): number {
  const x = clientX - sidebarLeft;
  const raw = Math.round((x - SIDEBAR_BASE_PX) / SIDEBAR_INDENT_PX);
  return Math.max(0, Math.min(maxDepth, raw));
}

export function dropDepthFromEvent(
  e: React.DragEvent,
  sidebarLeft: number,
  maxDepth: number,
): number {
  return dropDepthFromX(e.clientX, sidebarLeft, maxDepth);
}

export function positionFromY(clientY: number, rect: DOMRect): SidebarDropPosition {
  const ratio = (clientY - rect.top) / Math.max(rect.height, 1);
  if (ratio < 0.28) return "before";
  if (ratio > 0.72) return "after";
  return "inside";
}

export function findFolderRowAtY(
  clientY: number,
  flat: FolderOption[],
  rowRefs: Map<string, HTMLElement>,
): { folder: FolderOption; rect: DOMRect } | null {
  for (let i = 0; i < flat.length; i++) {
    const f = flat[i];
    const el = rowRefs.get(f.id);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (clientY < rect.top) {
      return { folder: f, rect };
    }
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return { folder: f, rect };
    }
  }
  const last = flat[flat.length - 1];
  if (last) {
    const el = rowRefs.get(last.id);
    if (el) return { folder: last, rect: el.getBoundingClientRect() };
  }
  return null;
}

export function hintFromPointer(
  folder: FolderOption,
  clientX: number,
  clientY: number,
  rect: DOMRect,
  sidebarLeft: number,
): { targetId: string; position: SidebarDropPosition; depth: number } {
  const position = positionFromY(clientY, rect);
  const depth = resolveDropDepthFromPointer(folder, position, clientX, sidebarLeft);
  return { targetId: folder.id, position, depth };
}

function resolveDropDepthFromPointer(
  folder: FolderOption,
  position: SidebarDropPosition,
  clientX: number,
  sidebarLeft: number,
): number {
  const depth = folderDepth(folder);
  const maxDepth = position === "inside" ? depth + 1 : depth;
  return dropDepthFromX(clientX, sidebarLeft, maxDepth);
}

function folderByPath(path: string, all: FolderOption[]): FolderOption | undefined {
  return all.find((f) => f.path === path);
}

function parentIdAtDepth(
  folder: FolderOption,
  depth: number,
  all: FolderOption[],
): string | null {
  if (depth <= 0) return null;
  const parts = folder.path.split(" / ");
  if (depth >= parts.length) return folder.id;
  const parentPath = parts.slice(0, depth).join(" / ");
  return folderByPath(parentPath, all)?.id ?? null;
}

function refIdAtDepth(folder: FolderOption, depth: number, all: FolderOption[]): string {
  const parts = folder.path.split(" / ");
  const end = Math.min(depth + 1, parts.length);
  const path = parts.slice(0, end).join(" / ");
  return folderByPath(path, all)!.id;
}

function siblingsUnderParent(
  all: FolderOption[],
  parentId: string | null,
  excludeId?: string,
): FolderOption[] {
  return all
    .filter((f) => parentIdFromPath(f, all) === parentId && f.id !== excludeId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function dropTargetFromHint(
  hint: SidebarDropHint,
  all: FolderOption[],
  draggedId?: string,
): { parentId: string | null; beforeId: string | null } {
  if (hint.targetId === "root") {
    return { parentId: null, beforeId: null };
  }
  const folder = all.find((f) => f.id === hint.targetId);
  if (!folder) return { parentId: null, beforeId: null };

  if (hint.position === "inside") {
    return { parentId: folder.id, beforeId: null };
  }

  const parentId = parentIdAtDepth(folder, hint.depth, all);
  const refId = refIdAtDepth(folder, hint.depth, all);

  if (hint.position === "before") {
    return { parentId, beforeId: refId };
  }

  const siblings = siblingsUnderParent(all, parentId, draggedId);
  const idx = siblings.findIndex((s) => s.id === refId);
  const beforeId = idx >= 0 && idx + 1 < siblings.length ? siblings[idx + 1].id : null;
  return { parentId, beforeId };
}

export function sidebarHintFromEvent(
  folder: FolderOption,
  e: React.DragEvent,
  sidebarLeft: number,
): { targetId: string; position: SidebarDropPosition; depth: number } {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return hintFromPointer(folder, e.clientX, e.clientY, rect, sidebarLeft);
}
