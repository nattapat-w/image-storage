"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  FolderOpen,
  FolderPlus,
  Globe,
  Grid2x2,
  Grid3x3,
  HardDrive,
  ImageIcon,
  LayoutGrid,
  List,
  MoreHorizontal,
  Rows3,
  Search,
  Share2,
  Trash2,
  Upload,
  Lock,
  FolderInput,
  Pencil,
  Star,
  Calendar,
  RotateCcw,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { useAuth, userDisplayName } from "@/components/AuthProvider";
import { AuthImage } from "@/components/AuthImage";
import { ConfirmDialog } from "@/components/drive/ConfirmDialog";
import { NewFolderDialog } from "@/components/drive/NewFolderDialog";
import { RenameDialog } from "@/components/drive/RenameDialog";
import {
  normalizeTagNames,
  TagChipInput,
  tagListsEqual,
} from "@/components/drive/TagChipInput";
import { DriveBreadcrumbs } from "@/components/drive/DriveBreadcrumbs";
import { DriveImageThumb } from "@/components/drive/DriveImageThumb";
import { DriveVisibilityBadge } from "@/components/drive/DriveVisibilityBadge";
import { TimelineView } from "@/components/drive/TimelineView";
import {
  DetailView,
  GridView,
  ListView,
} from "@/components/drive/DriveContentViews";
import {
  DRAG_TYPE,
  FOLDER_DRAG_TYPE,
  type Sort,
  type ViewMode,
} from "@/components/drive/constants";
import { dragIncludesImages, readImageDragIds } from "@/components/drive/image-drag";
import { isDriveKeyboardTarget } from "@/components/drive/image-keyboard";
import { ImageMarqueeSurface } from "@/components/drive/ImageMarqueeSurface";
import { useImageMultiSelect } from "@/components/drive/useImageMultiSelect";
import { folderOptionToFolderType, folderStatsLabel } from "@/components/drive/drive-format";
import {
  parentIdFromSidebarHint,
  sidebarHintFromEvent,
  type SidebarDropHint,
} from "@/components/drive/sidebar-drop";
import { SIDEBAR_INDENT_PX } from "@/lib/folder-tree";
import { api, ApiError, formatBytes } from "@/lib/api";
import { prefetchImageBlob } from "@/lib/image-blob-cache";
import { displayImageName, joinImageName, splitImageName } from "@/lib/image-name";
import type {
  Breadcrumb,
  BrowseMode,
  Folder as FolderType,
  FolderOption,
  ImageItem,
  Tag,
  TimelineGroup,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const isDev = process.env.NODE_ENV === "development";

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

type RenameTarget = {
  type: "folder" | "image";
  id: string;
  name: string;
  extension?: string;
  mimeType?: string;
};

export function DriveBrowser() {
  const [folderId, setFolderId] = useState<string | undefined>();
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [crumbs, setCrumbs] = useState<Breadcrumb[]>([]);
  const [allFolders, setAllFolders] = useState<FolderOption[]>([]);
  const [sort, setSort] = useState<Sort>("name");
  const [view, setView] = useState<ViewMode>("grid-medium");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ImageItem | null>(null);
  const [bulkMoveIds, setBulkMoveIds] = useState<string[] | null>(null);
  const [moveTarget, setMoveTarget] = useState("root");
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [sidebarDropHint, setSidebarDropHint] = useState<SidebarDropHint | null>(null);
  const [fileDragDepth, setFileDragDepth] = useState(0);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewSaving, setPreviewSaving] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [imagesOpen, setImagesOpen] = useState(true);
  const [browseMode, setBrowseMode] = useState<BrowseMode>("folder");
  const [timelineGroups, setTimelineGroups] = useState<TimelineGroup[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState<string | undefined>();
  const [previewTags, setPreviewTags] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(
    async (folderIdOverride?: string | undefined) => {
      const allP = api.listAllFolders();
      const tagsP = api.listTags();

      if (browseMode === "timeline") {
        const [groups, all, tags] = await Promise.all([api.listTimeline(), allP, tagsP]);
        setTimelineGroups(groups);
        setFolders([]);
        setImages([]);
        setCrumbs([]);
        setAllFolders(all);
        setAllTags(tags);
        return;
      }

      let activeFolderId =
        folderIdOverride !== undefined ? folderIdOverride : folderId;

      let crumbs: Breadcrumb[] = [];
      if (browseMode === "folder") {
        try {
          crumbs = await api.breadcrumb(activeFolderId);
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) {
            activeFolderId = undefined;
            setFolderId(undefined);
            crumbs = [];
          } else {
            throw e;
          }
        }
      }

      const listOpts =
        browseMode === "favorites"
          ? { favorite: true, sort }
          : browseMode === "trash"
            ? { trash: true, sort }
            : tagFilter
              ? { tag: tagFilter, sort }
              : { folderId: activeFolderId, sort };

      const [f, i, all, tags] = await Promise.all([
        browseMode === "folder" ? api.listFolders(activeFolderId) : Promise.resolve([] as FolderType[]),
        api.listImages(listOpts),
        allP,
        tagsP,
      ]);
      setTimelineGroups([]);
      setFolders(f);
      setImages(i);
      setCrumbs(crumbs);
      setAllFolders(all);
      setAllTags(tags);
    },
    [folderId, sort, browseMode, tagFilter],
  );

  useEffect(() => {
    refresh().catch(() => toast.error("Failed to load files"));
  }, [refresh]);

  const filteredFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, query]);

  const filteredImages = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      browseMode === "timeline"
        ? timelineGroups.flatMap((g) => g.images)
        : images;
    if (!q) return base;
    return base.filter((img) => img.name.toLowerCase().includes(q));
  }, [images, timelineGroups, browseMode, query]);

  const {
    selectedIds: selectedImageIds,
    selectedCount,
    isSelected: isImageSelected,
    handleSelectClick: onImageSelectClick,
    selectAll,
    clearSelection,
    idsForBulkAction,
    applyMarqueeSelection,
  } = useImageMultiSelect(filteredImages);

  const openPreview = useCallback((img: ImageItem) => {
    setSelected(img);
  }, []);

  useEffect(() => {
    clearSelection();
  }, [folderId, browseMode, tagFilter, clearSelection]);

  const previewImageIndex = useMemo(() => {
    if (!selected) return -1;
    return filteredImages.findIndex((img) => img.id === selected.id);
  }, [selected, filteredImages]);

  const canGoPreviousImage = previewImageIndex > 0;
  const canGoNextImage =
    previewImageIndex >= 0 && previewImageIndex < filteredImages.length - 1;

  const browseLabel: Record<BrowseMode, string> = {
    folder: crumbs.length > 0 ? crumbs[crumbs.length - 1].name : "My Drive",
    favorites: "Favorites",
    timeline: "Timeline",
    trash: "Trash",
  };

  const locationLabel = browseLabel[browseMode];

  const sortedAllFolders = useMemo(
    () => [...allFolders].sort((a, b) => a.path.localeCompare(b.path)),
    [allFolders],
  );

  useEffect(() => {
    if (!selected) return;
    setPreviewName(splitImageName(selected.name, selected.mimeType).baseName);
    setPreviewTags([...selected.tags]);
  }, [selected?.id]);

  const selectAdjacentPreviewImage = useCallback(
    (delta: -1 | 1) => {
      if (!selected) return;
      const idx = filteredImages.findIndex((img) => img.id === selected.id);
      if (idx < 0) return;
      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= filteredImages.length) return;
      const nextImg = filteredImages[nextIdx];
      setSelected(nextImg);
      const prefetchIdx = nextIdx + delta;
      if (prefetchIdx >= 0 && prefetchIdx < filteredImages.length) {
        const prefetchImg = filteredImages[prefetchIdx];
        if (prefetchImg.visibility !== "public") {
          prefetchImageBlob(api.imageFileUrl(prefetchImg.id));
        }
      }
    },
    [selected, filteredImages],
  );

  const selectPreviousImage = useCallback(() => {
    selectAdjacentPreviewImage(-1);
  }, [selectAdjacentPreviewImage]);

  const selectNextImage = useCallback(() => {
    selectAdjacentPreviewImage(1);
  }, [selectAdjacentPreviewImage]);

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, [contenteditable='true']")
      ) {
        return;
      }
      e.preventDefault();
      if (e.key === "ArrowLeft") selectAdjacentPreviewImage(-1);
      else selectAdjacentPreviewImage(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, selectAdjacentPreviewImage]);

  async function createFolder(name: string) {
    await api.createFolder(name, folderId);
    toast.success("Folder created");
    await refresh();
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    const t = toast.loading("Uploadingโ€ฆ");
    let uploaded = 0;
    try {
      for (const file of Array.from(files)) {
        await api.uploadImage(file, browseMode === "folder" ? folderId : undefined);
        uploaded++;
      }
      if (uploaded > 0) {
        toast.success(`Uploaded ${uploaded} file(s)`, { id: t });
      }
      await refresh();
    } catch {
      toast.error("Upload failed", { id: t });
    }
  }

  async function moveImagesToFolder(imageIds: string[], targetFolderId: string | null) {
    const unique = [...new Set(imageIds)];
    if (!unique.length) return;

    let moved = 0;
    for (const imageId of unique) {
      const img =
        images.find((i) => i.id === imageId) ?? filteredImages.find((i) => i.id === imageId);
      const current = img?.folderId ?? null;
      if (current === targetFolderId) continue;
      await api.updateImage(imageId, {
        folderId: targetFolderId === null ? "" : targetFolderId,
      });
      moved++;
    }

    if (moved === 0) return;
    toast.success(moved === 1 ? "Moved" : `Moved ${moved} items`);
    clearSelection();
    await refresh();
  }

  function openMoveDialog(contextImg?: ImageItem) {
    const ids = idsForBulkAction(contextImg?.id);
    if (!ids.length || browseMode === "trash") return;
    setBulkMoveIds(ids);
    setMoveTarget("root");
  }

  function askBulkTrash() {
    const ids = idsForBulkAction();
    if (!ids.length) return;

    if (browseMode === "trash") {
      setConfirm({
        title: `Delete ${ids.length} item(s) forever?`,
        message: "This cannot be undone.",
        confirmLabel: "Delete forever",
        destructive: true,
        onConfirm: async () => {
          for (const id of ids) {
            await api.deleteImagePermanent(id);
            if (selected?.id === id) setSelected(null);
          }
          clearSelection();
          toast.success("Permanently deleted");
          await refresh();
        },
      });
      return;
    }

    setConfirm({
      title: ids.length === 1 ? "Move to trash?" : `Move ${ids.length} items to trash?`,
      message: "You can restore them later from Trash.",
      confirmLabel: "Move to trash",
      destructive: true,
      onConfirm: async () => {
        for (const id of ids) {
          await api.deleteImage(id);
          if (selected?.id === id) setSelected(null);
        }
        clearSelection();
        toast.success(ids.length === 1 ? "Moved to trash" : `Moved ${ids.length} items to trash`);
        await refresh();
      },
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isDriveKeyboardTarget(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
        return;
      }
      if (e.key === "Escape" && selectedCount > 0) {
        e.preventDefault();
        clearSelection();
        return;
      }
      if (e.key === "Delete" && selectedCount > 0) {
        e.preventDefault();
        askBulkTrash();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectAll, clearSelection, selectedCount, browseMode, selected, idsForBulkAction]);

  async function moveFolderToParent(folderToMove: string, targetParentId: string | null) {
    await api.updateFolder(folderToMove, {
      parentId: targetParentId === null ? null : targetParentId,
    });
    toast.success("Folder moved");
    await refresh();
  }

  function readDraggedFolderId(e: React.DragEvent): string | null {
    if (e.dataTransfer.types.includes(DRAG_TYPE)) return null;
    if (!e.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) return null;
    const id = e.dataTransfer.getData(FOLDER_DRAG_TYPE);
    return id || null;
  }

  function isFolderDescendantOf(folderId: string, ancestorId: string): boolean {
    const folder = allFolders.find((f) => f.id === folderId);
    const ancestor = allFolders.find((f) => f.id === ancestorId);
    if (!folder || !ancestor) return false;
    return folder.id === ancestor.id || folder.path.startsWith(`${ancestor.path} / `);
  }

  function canDropFolderOn(draggedFolderId: string, targetParentId: string | null): boolean {
    if (targetParentId === draggedFolderId) return false;
    if (targetParentId && isFolderDescendantOf(targetParentId, draggedFolderId)) return false;

    const dragged = allFolders.find((f) => f.id === draggedFolderId);
    if (!dragged) return false;

    const parentPath = dragged.path.includes(" / ")
      ? dragged.path.split(" / ").slice(0, -1).join(" / ")
      : "";
    const targetPath =
      targetParentId === null
        ? ""
        : (allFolders.find((f) => f.id === targetParentId)?.path ?? "\0");
    return parentPath !== targetPath;
  }

  function folderDropErrorMessage(draggedFolderId: string, targetParentId: string | null): string {
    const dragged = allFolders.find((f) => f.id === draggedFolderId);
    if (!dragged) return "Can't move this folder";
    const parentPath = dragged.path.includes(" / ")
      ? dragged.path.split(" / ").slice(0, -1).join(" / ")
      : "";
    const targetPath =
      targetParentId === null
        ? ""
        : (allFolders.find((f) => f.id === targetParentId)?.path ?? "");
    if (parentPath === targetPath) return "Folder is already here";
    return "Can't move a folder into itself or its subfolder";
  }

  function isInternalDrag(e: React.DragEvent) {
    return dragIncludesImages(e) || e.dataTransfer.types.includes(FOLDER_DRAG_TYPE);
  }

  function onFolderDragStart(e: React.DragEvent, id: string) {
    e.stopPropagation();
    e.dataTransfer.setData(FOLDER_DRAG_TYPE, id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onFolderDragEnd() {
    setSidebarDropHint(null);
    setDragOverFolder(null);
  }

  function onSidebarDrop(e: React.DragEvent, hint: SidebarDropHint) {
    e.preventDefault();
    e.stopPropagation();
    setSidebarDropHint(null);
    setDragOverFolder(null);

    const targetParentId = parentIdFromSidebarHint(hint, allFolders);

    const draggedFolderId = readDraggedFolderId(e);
    if (draggedFolderId) {
      if (!canDropFolderOn(draggedFolderId, targetParentId)) {
        toast.error(folderDropErrorMessage(draggedFolderId, targetParentId));
        return;
      }
      moveFolderToParent(draggedFolderId, targetParentId).catch(() => toast.error("Move failed"));
      return;
    }

    const imageIds = readImageDragIds(e);
    if (!imageIds.length) return;
    moveImagesToFolder(imageIds, targetParentId).catch(() => toast.error("Move failed"));
  }

  function askDeleteImage(id: string, name: string) {
    const display = displayImageName(name, undefined);
    if (browseMode === "trash") {
      setConfirm({
        title: "Delete forever?",
        message: `"${display}" will be permanently removed. This cannot be undone.`,
        confirmLabel: "Delete forever",
        destructive: true,
        onConfirm: async () => {
          await api.deleteImagePermanent(id);
          if (selected?.id === id) setSelected(null);
          toast.success("Permanently deleted");
          await refresh();
        },
      });
      return;
    }
    setConfirm({
      title: "Move to trash?",
      message: `"${display}" will move to Trash. You can restore it later.`,
      confirmLabel: "Move to trash",
      destructive: true,
      onConfirm: async () => {
        await api.deleteImage(id);
        if (selected?.id === id) setSelected(null);
        toast.success("Moved to trash");
        await refresh();
      },
    });
  }

  function askDeleteAllImages() {
    setConfirm({
      title: "Delete everything?",
      message:
        "Every image (including trash) and every folder will be permanently deleted from storage and the database. This cannot be undone. Dev only.",
      confirmLabel: "Delete everything",
      destructive: true,
      onConfirm: async () => {
        try {
          const { deleted, foldersDeleted } = await api.deleteAllImages();
          setSelected(null);
          setFolderId(undefined);
          if (deleted === 0 && foldersDeleted === 0) {
            toast.success("Nothing to delete");
          } else {
            toast.success(
              `Deleted ${deleted} image(s) and ${foldersDeleted} folder(s)`,
            );
          }
          await refresh();
        } catch {
          toast.error("Failed to delete everything");
        }
      },
    });
  }

  async function restoreImage(id: string) {
    await api.restoreImage(id);
    toast.success("Restored");
    await refresh();
  }

  async function toggleFavorite(img: ImageItem) {
    const updated = await api.updateImage(img.id, { favorite: !img.favorite });
    if (selected?.id === img.id) setSelected(updated);
    await refresh();
    toast.success(updated.favorite ? "Added to favorites" : "Removed from favorites");
  }

  function askDeleteFolder(id: string, name: string) {
    setConfirm({
      title: "Delete folder?",
      message: `"${name}" and everything inside will be deleted.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        const nextFolderId = folderId === id ? undefined : folderId;
        await api.deleteFolder(id);
        if (folderId === id) setFolderId(undefined);
        toast.success("Folder deleted");
        await refresh(nextFolderId);
      },
    });
  }

  async function toggleVisibility(img: ImageItem) {
    const v = img.visibility === "public" ? "private" : "public";
    await api.updateImage(img.id, { visibility: v });
    toast.success(v === "public" ? "Now public" : "Now private");
    await refresh();
    if (selected?.id === img.id) setSelected({ ...img, visibility: v });
  }

  async function shareItem(type: "image" | "folder", id: string) {
    const s = await api.createShare(type, id);
    const url = `${window.location.origin}${s.url}`;
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard");
  }

  async function handleRename(name: string) {
    if (!renameTarget) return;
    if (renameTarget.type === "folder") {
      await api.updateFolder(renameTarget.id, { name });
    } else {
      const full = joinImageName(name, renameTarget.extension ?? "", renameTarget.mimeType);
      await api.updateImage(renameTarget.id, { name: full });
      if (selected?.id === renameTarget.id) {
        setSelected({ ...selected, name: full });
      }
    }
    toast.success("Renamed");
    await refresh();
  }

  async function savePreviewChanges() {
    if (!selected || browseMode === "trash") return;
    const { extension } = splitImageName(selected.name, selected.mimeType);
    const fullName = joinImageName(previewName, extension, selected.mimeType);
    const nameDirty = Boolean(fullName && fullName !== selected.name);
    const tags = normalizeTagNames(previewTags);
    const tagsDirty = !tagListsEqual(previewTags, selected.tags);
    if (!nameDirty && !tagsDirty) return;
    if (!previewName.trim()) {
      toast.error("File name cannot be empty");
      return;
    }

    setPreviewSaving(true);
    try {
      let img = selected;
      if (nameDirty) {
        await api.updateImage(selected.id, { name: fullName });
        img = { ...img, name: fullName };
      }
      if (tagsDirty) {
        img = await api.setImageTags(selected.id, tags);
      }
      const savedTags = tagsDirty ? tags : img.tags;
      setSelected({ ...img, tags: savedTags });
      setPreviewName(splitImageName(img.name, img.mimeType).baseName);
      setPreviewTags([...savedTags]);
      toast.success("Changes saved");
      await refresh();
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setPreviewSaving(false);
    }
  }

  function askRenameFolder(f: FolderType) {
    setRenameTarget({ type: "folder", id: f.id, name: f.name });
  }

  function askRenameImage(img: ImageItem) {
    const { baseName, extension } = splitImageName(img.name, img.mimeType);
    setRenameTarget({
      type: "image",
      id: img.id,
      name: baseName,
      extension,
      mimeType: img.mimeType,
    });
  }

  function onFolderDrop(e: React.DragEvent, targetId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);

    const draggedFolderId = readDraggedFolderId(e);
    if (draggedFolderId) {
      if (!canDropFolderOn(draggedFolderId, targetId)) {
        toast.error(folderDropErrorMessage(draggedFolderId, targetId));
        return;
      }
      moveFolderToParent(draggedFolderId, targetId).catch(() => toast.error("Move failed"));
      return;
    }

    const imageIds = readImageDragIds(e);
    if (!imageIds.length) return;
    moveImagesToFolder(imageIds, targetId).catch(() => toast.error("Move failed"));
  }

  function ImageMenu({ img }: { img: ImageItem }) {
    if (browseMode === "trash") {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-xs" className="text-[var(--muted-foreground)]">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-[188px] border-[var(--border)] bg-[var(--bg-floating)]">
            <DropdownMenuItem onClick={() => restoreImage(img.id)}>
              <RotateCcw className="size-4" />
              Restore
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => askDeleteImage(img.id, img.name)}>
              <Trash2 className="size-4" />
              Delete forever
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-xs" className="text-[var(--muted-foreground)]">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-[188px] border-[var(--border)] bg-[var(--bg-floating)]">
          <DropdownMenuItem onClick={() => toggleFavorite(img)}>
            <Star className={cn("size-4", img.favorite && "fill-[#f0b232] text-[#f0b232]")} />
            {img.favorite ? "Remove favorite" : "Add to favorites"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => askRenameImage(img)}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openMoveDialog(img)}>
            <FolderInput className="size-4" />
            Move to…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleVisibility(img)}>
            {img.visibility === "public" ? <Lock className="size-4" /> : <Globe className="size-4" />}
            {img.visibility === "public" ? "Make private" : "Make public"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => shareItem("image", img.id)}>
            <Share2 className="size-4" />
            Copy share link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => askDeleteImage(img.id, img.name)}>
            <Trash2 className="size-4" />
            Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function FolderMenu({ folder }: { folder: FolderType }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-xs" className="text-[var(--muted-foreground)]">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-[188px] border-[var(--border)] bg-[var(--bg-floating)]">
          <DropdownMenuItem onClick={() => askRenameFolder(folder)}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => shareItem("folder", folder.id)}>
            <Share2 className="size-4" />
            Copy share link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => askDeleteFolder(folder.id, folder.name)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const imageCount =
    browseMode === "timeline"
      ? timelineGroups.reduce((n, g) => n + g.images.length, 0)
      : images.length;

  function navigateToFolder(id: string | undefined) {
    setBrowseMode("folder");
    setFolderId(id);
    setTagFilter(undefined);
  }

  const sortLabel =
    sort === "name" ? "Name" : sort === "date" ? "Last modified" : "File size";

  const HeaderIcon =
    browseMode === "favorites"
      ? Star
      : browseMode === "timeline"
        ? Calendar
        : browseMode === "trash"
          ? Trash2
          : FolderOpen;

  const empty =
    browseMode === "timeline"
      ? false
      : browseMode === "folder"
        ? !filteredFolders.length && !filteredImages.length
        : !filteredImages.length;

  function emptyCopy() {
    if (query.trim()) {
      return { title: "No matches", subtitle: "Try a different search term", showUpload: false };
    }
    switch (browseMode) {
      case "favorites":
        return {
          title: "No favorites yet",
          subtitle: "Star images from the menu or image details to collect them here.",
          showUpload: false,
        };
      case "trash":
        return {
          title: "Trash is empty",
          subtitle: "Deleted images appear here. You can restore them or delete forever.",
          showUpload: false,
        };
      default:
        return {
          title: "This folder is empty",
          subtitle:
            "Drop images here or click Upload. Drag images onto any folder or My Drive in the sidebar to move them.",
          showUpload: true,
        };
    }
  }

  const allowUpload = browseMode !== "trash" && browseMode !== "favorites";

  const showFavoriteStar = browseMode !== "trash";
  const { user } = useAuth();
  const imageOwnerLabel = userDisplayName(user);

  return (
    <div
      className="flex h-screen overflow-hidden bg-[var(--bg-primary)]"
      onDragEnter={(e) => {
        if (!allowUpload || isInternalDrag(e)) return;
        if (e.dataTransfer.types.includes("Files")) setFileDragDepth((d) => d + 1);
      }}
      onDragLeave={() => setFileDragDepth((d) => Math.max(0, d - 1))}
      onDragOver={(e) => {
        if (!allowUpload) return;
        if (isInternalDrag(e) || e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        if (!allowUpload) return;
        if (isInternalDrag(e) || e.dataTransfer.getData(DRAG_TYPE) || e.dataTransfer.getData(FOLDER_DRAG_TYPE)) {
          e.preventDefault();
          return;
        }
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          setFileDragDepth(0);
          onUpload(e.dataTransfer.files);
        }
      }}
    >
      {/* Server rail */}
      <div className="hidden w-[72px] shrink-0 flex-col items-center gap-2 bg-[var(--bg-tertiary)] py-3 sm:flex">
        <div className="discord-rail-icon discord-rail-icon-active" title="image-storage">
          <ImageIcon className="size-6" />
        </div>
        <div className="discord-rail-icon" title="My Drive">
          <HardDrive className="size-5" />
        </div>
      </div>

      {/* Channel sidebar */}
      <aside className="flex min-h-0 w-full max-w-[240px] shrink-0 flex-col bg-[var(--bg-secondary)] sm:w-[240px]">
        <div className="flex h-12 items-center border-b border-[var(--bg-tertiary)] px-4 shadow-sm">
          <h1 className="truncate font-semibold text-[var(--header-primary)]">image-storage</h1>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-2 py-3">
          <div ref={sidebarRef}>
          <p className="discord-label mb-1 px-2">Quick access</p>
          <button
            type="button"
            className={cn(
              "discord-channel w-full text-left",
              browseMode === "folder" && !folderId && "discord-channel-active",
              sidebarDropHint?.targetId === "root" && "bg-[#5865f2]/20 text-[var(--header-primary)]",
            )}
            onClick={() => {
              setBrowseMode("folder");
              setFolderId(undefined);
              setTagFilter(undefined);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setSidebarDropHint({ targetId: "root", position: "inside" });
            }}
            onDragLeave={() => setSidebarDropHint(null)}
            onDrop={(e) => onSidebarDrop(e, { targetId: "root", position: "inside" })}
          >
            <HardDrive className="size-5 shrink-0 opacity-70" />
            My Drive
          </button>

          <button
            type="button"
            className={cn(
              "discord-channel w-full text-left",
              browseMode === "favorites" && "discord-channel-active",
            )}
            onClick={() => {
              setBrowseMode("favorites");
              setFolderId(undefined);
              setTagFilter(undefined);
            }}
          >
            <Star className="size-5 shrink-0 text-[#f0b232]" />
            Favorites
          </button>
          <button
            type="button"
            className={cn(
              "discord-channel w-full text-left",
              browseMode === "timeline" && "discord-channel-active",
            )}
            onClick={() => {
              setBrowseMode("timeline");
              setFolderId(undefined);
              setTagFilter(undefined);
            }}
          >
            <Calendar className="size-5 shrink-0 opacity-70" />
            Timeline
          </button>
          <button
            type="button"
            className={cn(
              "discord-channel w-full text-left",
              browseMode === "trash" && "discord-channel-active",
            )}
            onClick={() => {
              setBrowseMode("trash");
              setFolderId(undefined);
              setTagFilter(undefined);
            }}
          >
            <Trash2 className="size-5 shrink-0 opacity-70" />
            Trash
          </button>

          <p className="discord-label mb-1 mt-4 px-2">Folders</p>
          {sortedAllFolders.map((f, index) => {
            const depth = f.path.split(" / ").length - 1;
            const active = browseMode === "folder" && folderId === f.id;
            const folderRow = folderOptionToFolderType(f);
            const dropHint =
              sidebarDropHint?.targetId === f.id && "depth" in sidebarDropHint
                ? sidebarDropHint
                : null;
            const prevHint =
              index > 0 &&
              sidebarDropHint?.targetId === sortedAllFolders[index - 1].id &&
              "depth" in sidebarDropHint &&
              sidebarDropHint.position === "after"
                ? sidebarDropHint
                : null;
            const showTopLine =
              dropHint?.position === "before" || Boolean(prevHint);
            const showBottomLine =
              dropHint?.position === "after" && index === sortedAllFolders.length - 1;
            const lineDepth = showTopLine
              ? (dropHint?.position === "before" ? dropHint.depth : prevHint?.depth ?? 0)
              : (dropHint?.depth ?? 0);
            const lineLeft = 8 + lineDepth * SIDEBAR_INDENT_PX;
            return (
              <div
                key={f.id}
                className="relative mb-0.5"
                style={{ paddingLeft: 8 + depth * SIDEBAR_INDENT_PX }}
              >
                {showTopLine ? (
                  <div
                    className="pointer-events-none absolute top-0 right-2 z-10 h-0.5 rounded-full bg-[#5865f2]"
                    style={{ left: lineLeft }}
                  />
                ) : null}
                <div
                  draggable
                  onDragStart={(e) => onFolderDragStart(e, f.id)}
                  onDragEnd={onFolderDragEnd}
                  className={cn(
                    "group discord-channel w-full cursor-grab items-center gap-0.5 pr-1",
                    active && "discord-channel-active",
                    dropHint?.position === "inside" &&
                      "bg-[#5865f2]/20 ring-1 ring-[#5865f2]/50",
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
                    setSidebarDropHint(sidebarHintFromEvent(f, e, left));
                  }}
                  onDrop={(e) => {
                    const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
                    onSidebarDrop(e, sidebarHintFromEvent(f, e, left));
                  }}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 border-0 bg-transparent p-0 text-left text-inherit outline-none"
                    title={f.path}
                    onClick={() => {
                      setBrowseMode("folder");
                      setFolderId(f.id);
                      setTagFilter(undefined);
                    }}
                  >
                    <FolderOpen className="size-5 shrink-0 text-[#f0b232]" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">{f.name}</span>
                      <span className="block truncate text-[10px] text-[var(--muted-foreground)]">
                        {folderStatsLabel(f.imageCount, f.totalSize)}
                      </span>
                    </div>
                  </button>
                  <div
                    className={cn(
                      "shrink-0 self-center opacity-0 transition-opacity group-hover:opacity-100",
                      active && "opacity-100",
                    )}
                  >
                    <FolderMenu folder={folderRow} />
                  </div>
                </div>
                {showBottomLine ? (
                  <div
                    className="pointer-events-none absolute right-2 bottom-0 z-10 h-0.5 rounded-full bg-[#5865f2]"
                    style={{ left: lineLeft }}
                  />
                ) : null}
              </div>
            );
          })}
          </div>
        </ScrollArea>

      </aside>

      {/* Main content */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--bg-tertiary)] px-4 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {browseMode === "folder" ? (
              <DriveBreadcrumbs crumbs={crumbs} onNavigate={navigateToFolder} />
            ) : (
              <>
                <HeaderIcon className="size-6 shrink-0 text-[#f0b232]" />
                <span className="text-[20px] font-normal text-[var(--header-primary)]">{locationLabel}</span>
              </>
            )}
            {selectedCount > 0 ? (
              <div
                className="flex flex-wrap items-center gap-1.5 border-l border-[var(--border)] pl-3"
                data-no-marquee
              >
                <span className="text-[13px] font-medium text-[var(--header-primary)]">
                  {selectedCount} selected
                </span>
                {browseMode !== "trash" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 rounded-[3px] px-2 text-[12px]"
                    onClick={() => openMoveDialog()}
                  >
                    <FolderInput className="size-3.5" />
                    Move
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 rounded-[3px] px-2 text-[12px]"
                  onClick={askBulkTrash}
                >
                  <Trash2 className="size-3.5" />
                  {browseMode === "trash" ? "Delete forever" : "Trash"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-[3px] px-2 text-[12px]"
                  onClick={clearSelection}
                >
                  <X className="size-3.5" />
                  Clear
                </Button>
              </div>
            ) : null}
          </div>
          <span className="hidden text-[12px] text-[var(--muted-foreground)] sm:inline">
            {browseMode === "folder" ? `${filteredFolders.length} folders ` : ""}
            {imageCount} images
            {tagFilter ? `tag: ${tagFilter}` : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {isDev ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-[3px] text-[12px] text-[#f23f43] hover:bg-[#f23f43]/10 hover:text-[#f23f43]"
                onClick={askDeleteAllImages}
              >
                <Trash2 className="size-3.5" />
                Delete all
              </Button>
            ) : null}
            <ProfileMenu />
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--bg-tertiary)] px-4 py-3">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                browseMode === "folder" ? "Search in folder" : `Search in ${locationLabel.toLowerCase()}`
              }
              className="h-8 border-0 bg-[var(--input)] pl-8 text-[14px] rounded-[4px]"
            />
          </div>
          {browseMode === "folder" ? (
            <Button
              size="sm"
              className="h-8 rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4]"
              onClick={() => setNewFolderOpen(true)}
            >
              <FolderPlus className="size-4" />
              New folder
            </Button>
          ) : null}
          {allowUpload ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 rounded-[3px] bg-[#4e5058] hover:bg-[#6d6f78]"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              Upload
            </Button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onUpload(e.target.files)}
          />
          {browseMode === "folder" && allTags.length > 0 ? (
            <Select
              value={tagFilter ?? "__all__"}
              onValueChange={(v) => setTagFilter(v === "__all__" ? undefined : v ?? undefined)}
            >
              <SelectTrigger className="h-8 w-[130px] border-0 bg-[var(--input)] rounded-[4px]" size="sm">
                <SelectValue placeholder="All tags">
                  {(value) => {
                    if (!value || value === "__all__") return "All tags";
                    const tag = allTags.find((t) => t.name === value);
                    return tag ? `${tag.name} (${tag.imageCount})` : String(value);
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All tags</SelectItem>
                {allTags.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name} ({t.imageCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {browseMode !== "timeline" ? (
          <Select value={sort} onValueChange={(v) => v && setSort(v as Sort)}>
            <SelectTrigger className="h-8 w-[110px] border-0 bg-[var(--input)] rounded-[4px]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="size">Size</SelectItem>
            </SelectContent>
          </Select>
          ) : null}
          {browseMode !== "timeline" ? (
          <div className="flex gap-0.5 rounded-[4px] bg-[var(--bg-tertiary)] p-0.5">
            {(
              [
                ["grid-large", LayoutGrid, "Large icons"],
                ["grid-medium", Grid2x2, "Medium icons"],
                ["grid-small", Grid3x3, "Small icons"],
                ["list", List, "List"],
                ["detail", Rows3, "Details"],
              ] as const
            ).map(([mode, Icon, label]) => (
              <Button
                key={mode}
                type="button"
                size="icon-xs"
                variant="ghost"
                title={label}
                className={cn(
                  "rounded-[3px]",
                  view === mode && "bg-[var(--modifier-selected)] text-[var(--header-primary)]",
                )}
                onClick={() => setView(mode)}
              >
                <Icon className="size-4" />
              </Button>
            ))}
          </div>
          ) : null}
        </div>

        {browseMode !== "timeline" && view !== "detail" ? (
          <div className="flex items-center border-b border-[var(--bg-tertiary)] px-4 py-2">
            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--header-secondary)]">
              {sortLabel}
              <ArrowUp className="size-4 opacity-70" aria-hidden />
            </span>
          </div>
        ) : null}

        <ScrollArea className="min-h-0 flex-1 px-4 py-3">
          <ImageMarqueeSurface
            disabled={empty}
            onMarqueeSelect={applyMarqueeSelection}
            className="pb-2"
          >
          {browseMode === "timeline" ? (
            <TimelineView
              groups={timelineGroups}
              openPreview={openPreview}
              isImageSelected={isImageSelected}
              onImageSelectClick={onImageSelectClick}
              selectedImageIds={selectedImageIds}
              ImageThumb={DriveImageThumb}
              VisibilityBadge={DriveVisibilityBadge}
              ownerLabel={imageOwnerLabel}
              showFavoriteStar={showFavoriteStar}
              onToggleFavorite={toggleFavorite}
            />
          ) : empty ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center py-20 text-center",
                emptyCopy().showUpload
                  ? "cursor-pointer rounded-[8px] border-2 border-dashed border-[var(--border)] bg-[var(--bg-secondary)]/50"
                  : "",
              )}
              onClick={() => emptyCopy().showUpload && fileRef.current?.click()}
            >
              {browseMode === "trash" ? (
                <Trash2 className="mb-4 size-12 text-[var(--muted-foreground)]" />
              ) : browseMode === "favorites" ? (
                <Star className="mb-4 size-12 text-[var(--muted-foreground)]" />
              ) : (
                <Upload className="mb-4 size-12 text-[var(--muted-foreground)]" />
              )}
              <p className="text-[16px] font-medium text-[var(--header-primary)]">{emptyCopy().title}</p>
              <p className="mt-1 max-w-sm text-[14px] text-[var(--muted-foreground)]">
                {emptyCopy().subtitle}
              </p>
              {emptyCopy().showUpload && !query ? (
                <Button
                  className="mt-4 rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4]"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileRef.current?.click();
                  }}
                >
                  Upload images
                </Button>
              ) : null}
            </div>
          ) : view === "list" ? (
            <ListView
              folders={filteredFolders}
              images={filteredImages}
              foldersOpen={foldersOpen}
              imagesOpen={imagesOpen}
              onToggleFolders={() => setFoldersOpen((o) => !o)}
              onToggleImages={() => setImagesOpen((o) => !o)}
              dragOverFolder={dragOverFolder}
              setFolderId={navigateToFolder}
              openPreview={openPreview}
              isImageSelected={isImageSelected}
              onImageSelectClick={onImageSelectClick}
              selectedImageIds={selectedImageIds}
              setDragOverFolder={setDragOverFolder}
              onFolderDrop={onFolderDrop}
              onFolderDragStart={onFolderDragStart}
              askRenameFolder={askRenameFolder}
              askRenameImage={askRenameImage}
              shareItem={shareItem}
              askDeleteFolder={askDeleteFolder}
              ImageThumb={DriveImageThumb}
              ImageMenu={ImageMenu}
              FolderMenu={FolderMenu}
              VisibilityBadge={DriveVisibilityBadge}
              showFavoriteStar={showFavoriteStar}
              ownerLabel={imageOwnerLabel}
              onToggleFavorite={toggleFavorite}
            />
          ) : view === "detail" ? (
            <DetailView
              folders={filteredFolders}
              images={filteredImages}
              foldersOpen={foldersOpen}
              imagesOpen={imagesOpen}
              onToggleFolders={() => setFoldersOpen((o) => !o)}
              onToggleImages={() => setImagesOpen((o) => !o)}
              dragOverFolder={dragOverFolder}
              setFolderId={navigateToFolder}
              openPreview={openPreview}
              isImageSelected={isImageSelected}
              onImageSelectClick={onImageSelectClick}
              selectedImageIds={selectedImageIds}
              setDragOverFolder={setDragOverFolder}
              onFolderDrop={onFolderDrop}
              onFolderDragStart={onFolderDragStart}
              askRenameFolder={askRenameFolder}
              askRenameImage={askRenameImage}
              shareItem={shareItem}
              askDeleteFolder={askDeleteFolder}
              ImageThumb={DriveImageThumb}
              ImageMenu={ImageMenu}
              FolderMenu={FolderMenu}
              VisibilityBadge={DriveVisibilityBadge}
              showFavoriteStar={showFavoriteStar}
              ownerLabel={imageOwnerLabel}
              onToggleFavorite={toggleFavorite}
            />
          ) : (
            <GridView
              view={view}
              folders={filteredFolders}
              images={filteredImages}
              foldersOpen={foldersOpen}
              imagesOpen={imagesOpen}
              onToggleFolders={() => setFoldersOpen((o) => !o)}
              onToggleImages={() => setImagesOpen((o) => !o)}
              dragOverFolder={dragOverFolder}
              setFolderId={navigateToFolder}
              openPreview={openPreview}
              isImageSelected={isImageSelected}
              onImageSelectClick={onImageSelectClick}
              selectedImageIds={selectedImageIds}
              setDragOverFolder={setDragOverFolder}
              onFolderDrop={onFolderDrop}
              onFolderDragStart={onFolderDragStart}
              askRenameFolder={askRenameFolder}
              askRenameImage={askRenameImage}
              shareItem={shareItem}
              askDeleteFolder={askDeleteFolder}
              ImageThumb={DriveImageThumb}
              ImageMenu={ImageMenu}
              FolderMenu={FolderMenu}
              VisibilityBadge={DriveVisibilityBadge}
              showFavoriteStar={showFavoriteStar}
              ownerLabel={imageOwnerLabel}
              onToggleFavorite={toggleFavorite}
            />
          )}
          </ImageMarqueeSurface>
        </ScrollArea>
      </main>

      {fileDragDepth > 0 ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="rounded-[8px] border-2 border-dashed border-[#5865f2] bg-[var(--bg-primary)] px-12 py-10 text-center">
            <Upload className="mx-auto mb-3 size-10 text-[#5865f2]" />
            <p className="text-[18px] font-semibold text-[var(--header-primary)]">
              Drop to upload
            </p>
            <p className="text-[14px] text-[var(--muted-foreground)]">to {locationLabel}</p>
          </div>
        </div>
      ) : null}

      <NewFolderDialog open={newFolderOpen} onOpenChange={setNewFolderOpen} onCreate={createFolder} />

      <RenameDialog
        open={!!renameTarget}
        title={renameTarget?.type === "folder" ? "Rename folder" : "Rename image"}
        label={renameTarget?.type === "folder" ? "Folder name" : "File name"}
        initialName={renameTarget?.name ?? ""}
        extensionSuffix={renameTarget?.type === "image" ? renameTarget.extension : undefined}
        onOpenChange={(o) => !o && setRenameTarget(null)}
        onRename={handleRename}
      />

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel}
        destructive={confirm?.destructive}
        onConfirm={() => confirm?.onConfirm()}
        onOpenChange={(o) => !o && setConfirm(null)}
      />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="w-[min(48rem,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden border-[var(--border)] bg-[var(--bg-primary)] p-0 sm:max-w-none">
          {selected ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Image preview</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-2 px-6 pt-4 pr-12">
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <Label htmlFor="preview-name" className="sr-only">
                    File name
                  </Label>
                  <Input
                    id="preview-name"
                    value={previewName}
                    onChange={(e) => setPreviewName(e.target.value)}
                    disabled={browseMode === "trash"}
                    className="h-10 min-w-0 flex-1 rounded-[3px] border-0 bg-[var(--input)] text-[16px] font-medium text-[var(--header-primary)]"
                    onKeyDown={(e) => e.key === "Enter" && savePreviewChanges()}
                  />
                  <span className="shrink-0 px-1 text-[14px] text-[var(--muted-foreground)]">
                    {splitImageName(selected.name, selected.mimeType).extension}
                  </span>
                </div>
              </div>
              <div className="flex h-[min(50vh,400px)] w-full shrink-0 items-center gap-2 px-4 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="size-10 shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] shadow-sm"
                  aria-label="Previous image"
                  disabled={!canGoPreviousImage}
                  onClick={selectPreviousImage}
                >
                  <ChevronLeft className="size-6" />
                </Button>
                <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-[4px] bg-[var(--bg-tertiary)]/30">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-2 right-2 z-10 size-9 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)]/95 shadow-sm"
                    title={selected.favorite ? "Remove from favorites" : "Add to favorites"}
                    onClick={() => toggleFavorite(selected)}
                  >
                    <Star
                      className={cn(
                        "size-5",
                        selected.favorite && "fill-[#f0b232] text-[#f0b232]",
                      )}
                    />
                  </Button>
                  <div className="flex min-h-0 flex-1 items-center justify-center">
                    {selected.visibility === "public" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={api.publicImageUrl(selected.id)}
                        alt={displayImageName(selected.name, selected.mimeType)}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <AuthImage
                        src={api.imageFileUrl(selected.id)}
                        alt={displayImageName(selected.name, selected.mimeType)}
                        className="h-full w-full max-h-full max-w-full object-contain"
                      />
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="size-10 shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] shadow-sm"
                  aria-label="Next image"
                  disabled={!canGoNextImage}
                  onClick={selectNextImage}
                >
                  <ChevronRight className="size-6" />
                </Button>
              </div>
              <div className="space-y-3 px-6 pb-4 pt-3">
                {browseMode !== "trash" ? (
                  <>
                    <div>
                      <Label htmlFor="preview-tags" className="discord-label">
                        Tags
                      </Label>
                      <TagChipInput
                        key={selected.id}
                        id="preview-tags"
                        className="mt-1"
                        value={previewTags}
                        onChange={setPreviewTags}
                        onCommit={savePreviewChanges}
                      />
                      <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                        Enter to add a tag. Save changes when done.
                      </p>
                    </div>
                  </>
                ) : null}
                <p className="text-[12px] text-[var(--muted-foreground)]">
                  {formatBytes(selected.size)}  {selected.visibility}
                  {selected.takenAt ? ` ${new Date(selected.takenAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <DialogFooter className="-mx-0 -mb-0 mt-2 gap-2 rounded-none border-t border-[var(--border)] bg-[var(--bg-secondary)] px-6 py-4 sm:justify-end">
                <Button variant="secondary" className="rounded-[3px]" onClick={() => setSelected(null)}>
                  Close
                </Button>
                {browseMode === "trash" ? (
                  <>
                    <Button
                      variant="secondary"
                      className="rounded-[3px]"
                      onClick={() => restoreImage(selected.id)}
                    >
                      <RotateCcw className="size-4" />
                      Restore
                    </Button>
                    <Button
                      variant="destructive"
                      className="rounded-[3px]"
                      onClick={() => askDeleteImage(selected.id, selected.name)}
                    >
                      Delete forever
                    </Button>
                  </>
                ) : (
                  <Button
                    className="rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4]"
                    disabled={
                      previewSaving ||
                      !previewName.trim() ||
                      (joinImageName(
                        previewName,
                        splitImageName(selected.name, selected.mimeType).extension,
                        selected.mimeType,
                      ) === selected.name &&
                        tagListsEqual(previewTags, selected.tags))
                    }
                    onClick={savePreviewChanges}
                  >
                    {previewSaving ? "Saving…" : "Save changes"}
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!bulkMoveIds?.length} onOpenChange={(o) => !o && setBulkMoveIds(null)}>
        <DialogContent className="border-[var(--border)] bg-[var(--bg-primary)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--header-primary)]">
              {bulkMoveIds && bulkMoveIds.length > 1
                ? `Move ${bulkMoveIds.length} items`
                : bulkMoveIds?.[0]
                  ? `Move "${displayImageName(
                      images.find((i) => i.id === bulkMoveIds[0])?.name ??
                        filteredImages.find((i) => i.id === bulkMoveIds[0])?.name ??
                        "",
                      images.find((i) => i.id === bulkMoveIds[0])?.mimeType ??
                        filteredImages.find((i) => i.id === bulkMoveIds[0])?.mimeType,
                    )}"`
                  : "Move"}
            </DialogTitle>
          </DialogHeader>
          <Select value={moveTarget} onValueChange={(v) => v && setMoveTarget(v)}>
            <SelectTrigger className="border-0 bg-[var(--input)]">
              <SelectValue placeholder="Choose folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">My Drive (root)</SelectItem>
              {allFolders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.path}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="bg-[var(--bg-secondary)] -mx-6 -mb-6 px-6 py-4">
            <Button variant="secondary" className="rounded-[3px]" onClick={() => setBulkMoveIds(null)}>
              Cancel
            </Button>
            <Button
              className="rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4]"
              onClick={async () => {
                if (!bulkMoveIds?.length) return;
                await moveImagesToFolder(
                  bulkMoveIds,
                  moveTarget === "root" ? null : moveTarget,
                );
                setBulkMoveIds(null);
              }}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
