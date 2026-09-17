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
  Loader2,
  Menu,
  MoreHorizontal,
  Rows3,
  Search,
  Share2,
  Files,
  Download,
  Trash2,
  Upload,
  Lock,
  FolderInput,
  Pencil,
  Star,
  Users,
  Calendar,
  RotateCcw,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  resolveInitialDriveFolderId,
  stripDriveFolderFromUrl,
} from "@/lib/drive-folder-nav";
import { createFolderPrefetchScheduler } from "@/lib/drive-prefetch";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { useAuth, userDisplayName } from "@/components/AuthProvider";
import { AuthImage } from "@/components/AuthImage";
import { ConfirmDialog } from "@/components/drive/ConfirmDialog";
import { NewFolderDialog } from "@/components/drive/NewFolderDialog";
import { RenameDialog } from "@/components/drive/RenameDialog";
import { PublicLinkDialog } from "@/components/drive/PublicLinkDialog";
import { ShareFolderSettings } from "@/components/drive/ShareFolderSettings";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ShareFolderInviteNotice } from "@/components/share/ShareFolderInviteNotice";
import { useNotifications } from "@/hooks/useNotifications";
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
  DRIVE_OPEN_SURFACE,
  DRIVE_SELECT_SURFACE,
  FOLDER_DRAG_TYPE,
  type Sort,
  type ViewMode,
  uploadLimitForUser,
  VIEW_OPTIONS,
} from "@/components/drive/constants";
import { dragIncludesImages, isImageCopyDrag, readImageDragIds } from "@/components/drive/image-drag";
import { isDriveKeyboardTarget } from "@/components/drive/image-keyboard";
import { ImageMarqueeSurface } from "@/components/drive/ImageMarqueeSurface";
import { useImageMultiSelect } from "@/components/drive/useImageMultiSelect";
import { useFolderMultiSelect } from "@/components/drive/useFolderMultiSelect";
import {
  buildBreadcrumbFromAllFolders,
  folderOptionToFolderType,
  folderStatsLabel,
  imagePosterLabel,
  insertImageIntoTimelineGroups,
  insertImageSorted,
} from "@/components/drive/drive-format";
import {
  parentIdFromSidebarHint,
  sidebarHintFromEvent,
  type SidebarDropHint,
} from "@/components/drive/sidebar-drop";
import {
  SIDEBAR_INDENT_PX,
  MAX_FOLDER_NESTING,
  canCreateFolderIn,
  wouldExceedFolderNesting,
} from "@/lib/folder-tree";
import {
  addPendingAutoTagIds,
  clearPendingAutoTagIds,
  liveAutoTagElapsed,
  loadPendingAutoTagIds,
  removePendingAutoTagId,
  watchAutoTagJobs,
} from "@/lib/auto-tag-poll";
import {
  api,
  ApiError,
  apiErrorMessage,
  formatBytes,
  getToken,
  isSilentBrowseError,
  tryRequest,
} from "@/lib/api";
import { prefetchImageBlob } from "@/lib/image-blob-cache";
import { displayImageName, joinImageName, splitImageName } from "@/lib/image-name";
import type {
  AutoTagJob,
  Breadcrumb,
  BrowseMode,
  Folder as FolderType,
  FolderOption,
  ImageItem,
  IncomingShareFolderInvite,
  SharedFolderEntry,
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

type FolderListingCache = {
  folders: FolderType[];
  images: ImageItem[];
  crumbs: Breadcrumb[];
};

function folderListingCacheKey(folderId: string | undefined, sort: Sort) {
  return `${folderId ?? ""}|${sort}`;
}

function sortImagesForDrive(items: ImageItem[], sort: Sort): ImageItem[] {
  const copy = [...items];
  if (sort === "date") {
    copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } else if (sort === "size") {
    copy.sort((a, b) => b.size - a.size);
  } else {
    copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }
  return copy;
}

export type DriveBrowserProps = {
  /** @deprecated Legacy embed — folder navigation is in-app state only. */
  shareRootId?: string;
  shareFolderId?: string;
  onShareFolderNavigate?: (folderId: string) => void;
};

function inviteTokenFromUrl(inviteUrl: string): string {
  const trimmed = inviteUrl.replace(/\/+$/, "");
  const i = trimmed.lastIndexOf("/");
  return i >= 0 ? trimmed.slice(i + 1) : trimmed;
}

function SidebarSection({
  title,
  open,
  onToggle,
  trailing,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <button
        type="button"
        className="discord-label mb-1 flex w-full items-center gap-1 px-2 text-left hover:text-[var(--header-primary)]"
        onClick={onToggle}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 opacity-70" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {trailing}
      </button>
      {open ? children : null}
    </div>
  );
}

export function DriveBrowser({
  shareRootId: shareRootIdProp,
  shareFolderId,
}: DriveBrowserProps = {}) {
  const { user } = useAuth();

  const initialFolderIdRef = useRef<string | undefined>(
    shareRootIdProp ? shareFolderId ?? shareRootIdProp : resolveInitialDriveFolderId(),
  );

  type ShareBrowseContext = { rootId: string; ownerId: string; role: string };
  const [shareBrowse, setShareBrowse] = useState<ShareBrowseContext | null>(null);
  const [folderAccessReady, setFolderAccessReady] = useState(!initialFolderIdRef.current);
  const shareFolderCacheRef = useRef(new Map<string, ShareBrowseContext | null>());

  /** Share-folder APIs only when viewing someone else's tree (member). Owner uses My Drive APIs. */
  const useCollaborativeBrowse = Boolean(
    shareBrowse?.ownerId && user?.id && shareBrowse.ownerId !== user.id,
  );
  const collaborativeRootId = useCollaborativeBrowse ? shareBrowse!.rootId : undefined;
  const notifications = useNotifications(Boolean(user && getToken()));
  const [sharedEntries, setSharedEntries] = useState<SharedFolderEntry[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<IncomingShareFolderInvite[]>([]);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | undefined>(initialFolderIdRef.current);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [crumbs, setCrumbs] = useState<Breadcrumb[]>([]);
  const [allFolders, setAllFolders] = useState<FolderOption[]>([]);
  const [sort, setSort] = useState<Sort>("date");
  const [view, setView] = useState<ViewMode>("grid-medium");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ImageItem | null>(null);
  const [bulkMoveIds, setBulkMoveIds] = useState<string[] | null>(null);
  const [bulkCopyIds, setBulkCopyIds] = useState<string[] | null>(null);
  const [moveTarget, setMoveTarget] = useState("root");
  const [copyTarget, setCopyTarget] = useState("root");
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [sidebarDropHint, setSidebarDropHint] = useState<SidebarDropHint | null>(null);
  const [fileDragDepth, setFileDragDepth] = useState(0);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [shareSettingsFolder, setShareSettingsFolder] = useState<FolderType | null>(null);
  const [publicLinkFolder, setPublicLinkFolder] = useState<FolderType | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewSaving, setPreviewSaving] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [imagesOpen, setImagesOpen] = useState(true);
  const [sidebarFoldersOpen, setSidebarFoldersOpen] = useState(true);
  const [sidebarSharedOpen, setSidebarSharedOpen] = useState(true);
  const [browseMode, setBrowseMode] = useState<BrowseMode>("folder");
  const [timelineGroups, setTimelineGroups] = useState<TimelineGroup[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState<string | undefined>();
  const [previewTags, setPreviewTags] = useState<string[]>([]);
  const [taggingImageIds, setTaggingImageIds] = useState<ReadonlySet<string>>(() => new Set());
  const [autoTagJobs, setAutoTagJobs] = useState<Map<string, AutoTagJob>>(() => new Map());
  const [elapsedTick, setElapsedTick] = useState(0);
  const [contentLoading, setContentLoading] = useState(!!initialFolderIdRef.current);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const listingCacheRef = useRef(new Map<string, FolderListingCache>());
  const autoTagWatchRef = useRef(new Set<string>());
  const shareResolveGenRef = useRef(0);
  const contentLoadGenRef = useRef(0);
  const folderPrefetchRef = useRef(createFolderPrefetchScheduler());
  const prefetchContextRef = useRef({
    browseMode: "folder" as BrowseMode,
    tagFilter: undefined as string | undefined,
    sort: "date" as Sort,
    useCollaborativeBrowse: false,
    collaborativeRootId: undefined as string | undefined,
    sharedEntries: [] as SharedFolderEntry[],
    allFolders: [] as FolderOption[],
    folders: [] as FolderType[],
    crumbs: [] as Breadcrumb[],
  });

  const imageFileSrc = useCallback(
    (id: string) =>
      useCollaborativeBrowse ? api.shareFolderImageFileUrl(id) : api.imageFileUrl(id),
    [useCollaborativeBrowse],
  );

  function BoundImageThumb(props: { img: ImageItem; className?: string }) {
    return <DriveImageThumb {...props} shareFolder={useCollaborativeBrowse} />;
  }

  /** Legacy `/dashboard/shared/:id` props only — must not run when root comes from URL resolve. */
  useEffect(() => {
    if (!shareRootIdProp) return;
    setFolderId(shareFolderId ?? shareRootIdProp);
  }, [shareRootIdProp, shareFolderId]);

  useLayoutEffect(() => {
    if (shareRootIdProp) return;
    stripDriveFolderFromUrl();
  }, [shareRootIdProp]);

  useEffect(() => {
    if (browseMode !== "folder") {
      setShareBrowse(null);
      setFolderAccessReady(true);
      return;
    }
    if (!folderId) {
      setShareBrowse(null);
      setFolderAccessReady(true);
      return;
    }

    const cached = shareFolderCacheRef.current.get(folderId);
    if (cached !== undefined) {
      setShareBrowse(cached);
      setFolderAccessReady(true);
      return;
    }

    const gen = ++shareResolveGenRef.current;
    setShareBrowse(null);
    setFolderAccessReady(false);
    api
      .resolveShareFolderContext(folderId)
      .then((ctx) => {
        if (gen !== shareResolveGenRef.current) return;
        if (ctx.active) {
          const entry: ShareBrowseContext = {
            rootId: ctx.rootId,
            ownerId: ctx.ownerId,
            role: ctx.role,
          };
          shareFolderCacheRef.current.set(folderId, entry);
          if (ctx.rootId !== folderId) {
            shareFolderCacheRef.current.set(ctx.rootId, entry);
          }
          setShareBrowse(entry);
        } else {
          shareFolderCacheRef.current.set(folderId, null);
          setShareBrowse(null);
        }
        setFolderAccessReady(true);
      })
      .catch(() => {
        if (gen !== shareResolveGenRef.current) return;
        shareFolderCacheRef.current.set(folderId, null);
        setShareBrowse(null);
        setFolderAccessReady(true);
      });
  }, [folderId, browseMode]);

  const loadMeta = useCallback(async () => {
    const [all, tags, inv, shared] = await Promise.all([
      api.listAllFolders(),
      api.listTags(),
      api.listIncomingShareFolderInvites(),
      api.listSharedFolders(),
    ]);
    setAllFolders(all);
    setAllTags(tags);
    setIncomingInvites(inv);
    setSharedEntries(shared);
  }, []);

  const isImageTagging = useCallback(
    (id: string) => {
      const job = autoTagJobs.get(id);
      if (job?.state === "running") return true;
      return taggingImageIds.has(id) && job?.state !== "failed";
    },
    [autoTagJobs, taggingImageIds],
  );

  const getTaggingElapsed = useCallback(
    (id: string) => liveAutoTagElapsed(autoTagJobs.get(id)),
    [autoTagJobs, elapsedTick],
  );

  useEffect(() => {
    const running = [...autoTagJobs.values()].some((job) => job.state === "running");
    if (!running) return;
    const timer = setInterval(() => setElapsedTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [autoTagJobs]);

  const patchTaggedImage = useCallback((img: ImageItem) => {
    setImages((prev) => prev.map((item) => (item.id === img.id ? img : item)));
    setTimelineGroups((prev) =>
      prev.map((group) => ({
        ...group,
        images: group.images.map((item) => (item.id === img.id ? img : item)),
      })),
    );
    setSelected((current) => {
      if (current?.id !== img.id) return current;
      setPreviewTags([...img.tags]);
      return img;
    });
  }, []);

  const startAutoTagWatch = useCallback(
    (imageIds: string[], { notify = true }: { notify?: boolean } = {}) => {
      const pending = imageIds.filter((id) => !autoTagWatchRef.current.has(id));
      if (!pending.length) return;

      for (const id of pending) autoTagWatchRef.current.add(id);
      addPendingAutoTagIds(pending);
      setTaggingImageIds((prev) => new Set([...prev, ...pending]));
      if (notify) {
        toast.info("AI is tagging your upload…", { id: "auto-tag", duration: Infinity });
      }

      const clearTagging = (id: string) => {
        autoTagWatchRef.current.delete(id);
        removePendingAutoTagId(id);
        setTaggingImageIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      };

      void watchAutoTagJobs(
        pending,
        async (ids) => (await api.getAutoTagStatus(ids)).jobs,
        api.getImage,
        {
          onStatus: (jobs) => {
            setAutoTagJobs((prev) => {
              const next = new Map(prev);
              for (const job of jobs) next.set(job.imageId, job);
              return next;
            });
          },
          onTagged: (img) => {
            patchTaggedImage(img);
            clearTagging(img.id);
            void loadMeta();
          },
          onFailed: (job) => {
            clearTagging(job.imageId);
            toast.error(`AI tagging failed${job.error ? `: ${job.error}` : ""}`, {
              description: "Try uploading again or check Ollama logs.",
            });
          },
        },
        { intervalMs: 2000, timeoutMs: 180_000 },
      ).then(({ tagged, failed, timedOut }) => {
        if (tagged > 0 && failed === 0 && timedOut === 0) {
          toast.success(`AI tagged ${tagged} image${tagged === 1 ? "" : "s"}`, {
            id: "auto-tag",
          });
          return;
        }
        if (tagged > 0 && (failed > 0 || timedOut > 0)) {
          toast.warning(`AI tagged ${tagged} image${tagged === 1 ? "" : "s"}; some jobs did not finish`, {
            id: "auto-tag",
          });
          return;
        }
        if (failed > 0) {
          toast.error("AI tagging failed", { id: "auto-tag" });
          return;
        }
        if (timedOut > 0) {
          toast.warning("AI tagging timed out. Check API logs or try GPU mode (`pnpm ollama:gpu:up`).", {
            id: "auto-tag",
          });
          return;
        }
        toast.dismiss("auto-tag");
      });
    },
    [loadMeta, patchTaggedImage],
  );

  useEffect(() => {
    if (user?.autoTagEnabled) return;
    clearPendingAutoTagIds();
    autoTagWatchRef.current.clear();
    setTaggingImageIds(new Set());
    setAutoTagJobs(new Map());
    toast.dismiss("auto-tag");
  }, [user?.autoTagEnabled]);

  useEffect(() => {
    if (!user?.autoTagEnabled) return;
    const resumeIds = loadPendingAutoTagIds().filter((id) => !autoTagWatchRef.current.has(id));
    if (!resumeIds.length) return;
    startAutoTagWatch(resumeIds, { notify: false });
  }, [user?.autoTagEnabled, startAutoTagWatch]);

  const loadContents = useCallback(
    async (folderIdOverride?: string | undefined) => {
      const gen = ++contentLoadGenRef.current;
      const isCurrent = () => gen === contentLoadGenRef.current;

      if (browseMode === "timeline") {
        setContentLoading(true);
        try {
          const groups = await api.listTimeline();
          if (!isCurrent()) return;
          setTimelineGroups(groups);
          setFolders([]);
          setImages([]);
          setCrumbs([]);
        } finally {
          if (isCurrent()) setContentLoading(false);
        }
        return;
      }

      let activeFolderId =
        folderIdOverride !== undefined ? folderIdOverride : folderId;

      if (useCollaborativeBrowse && collaborativeRootId) {
        setContentLoading(true);
        const activeId = activeFolderId ?? collaborativeRootId;
        const browseParent = activeId === collaborativeRootId ? undefined : activeId;
        try {
          const [data, crumbsResult] = await Promise.all([
            api.browseSharedFolder(collaborativeRootId, browseParent),
            api.shareFolderBreadcrumb(collaborativeRootId, activeId),
          ]);
          if (!isCurrent()) return;
          setTimelineGroups([]);
          setFolders(data.folders);
          setImages(sortImagesForDrive(data.images, sort));
          setCrumbs(crumbsResult);
        } finally {
          if (isCurrent()) setContentLoading(false);
        }
        return;
      }

      const cacheKey =
        browseMode === "folder" && !tagFilter
          ? folderListingCacheKey(activeFolderId, sort)
          : null;

      if (cacheKey) {
        const cached = listingCacheRef.current.get(cacheKey);
        if (cached && isCurrent()) {
          setTimelineGroups([]);
          setFolders(cached.folders);
          setImages(cached.images);
          setCrumbs(cached.crumbs);
          setContentLoading(false);
        } else {
          setContentLoading(true);
        }
      } else {
        setContentLoading(true);
      }

      try {
        const listOpts =
          browseMode === "favorites"
            ? { favorite: true, sort }
            : browseMode === "trash"
              ? { trash: true, sort }
              : tagFilter
                ? { tag: tagFilter, sort }
                : { folderId: activeFolderId, sort };

        const breadcrumbP =
          browseMode === "folder"
            ? api.breadcrumb(activeFolderId).catch((e) => {
                if (e instanceof ApiError && e.status === 404) {
                  return [] as Breadcrumb[];
                }
                throw e;
              })
            : Promise.resolve([] as Breadcrumb[]);

        const [crumbsResult, f, i] = await Promise.all([
          breadcrumbP,
          browseMode === "folder"
            ? api.listFolders(activeFolderId)
            : Promise.resolve([] as FolderType[]),
          api.listImages(listOpts),
        ]);

        if (!isCurrent()) return;

        setTimelineGroups([]);
        setFolders(f);
        setImages(i);
        setCrumbs(crumbsResult);

        if (cacheKey) {
          listingCacheRef.current.set(cacheKey, {
            folders: f,
            images: i,
            crumbs: crumbsResult,
          });
        }
      } finally {
        if (isCurrent()) setContentLoading(false);
      }
    },
    [folderId, sort, browseMode, tagFilter, useCollaborativeBrowse, collaborativeRootId],
  );

  const reloadAll = useCallback(
    async (folderIdOverride?: string | undefined) => {
      listingCacheRef.current.clear();
      await Promise.all([loadMeta(), loadContents(folderIdOverride)]);
    },
    [loadMeta, loadContents],
  );

  prefetchContextRef.current = {
    browseMode,
    tagFilter,
    sort,
    useCollaborativeBrowse,
    collaborativeRootId,
    sharedEntries,
    allFolders,
    folders,
    crumbs,
  };

  const shouldSharePrefetch = useCallback((id: string, ctx: typeof prefetchContextRef.current) => {
    if (!ctx.useCollaborativeBrowse || !ctx.collaborativeRootId) return false;
    if (ctx.allFolders.some((f) => f.id === id)) return false;
    return (
      id === ctx.collaborativeRootId ||
      ctx.sharedEntries.some((e) => e.folder.id === id) ||
      ctx.folders.some((f) => f.id === id) ||
      ctx.crumbs.some((c) => c.id === id)
    );
  }, []);

  const prefetchFolderListing = useCallback(
    (id: string) => {
      const ctx = prefetchContextRef.current;
      if (ctx.browseMode !== "folder" || ctx.tagFilter) return;

      const prefetchKey = shouldSharePrefetch(id, ctx)
        ? `share:${ctx.collaborativeRootId}:${id}`
        : folderListingCacheKey(id, ctx.sort);

      if (!shouldSharePrefetch(id, ctx) && listingCacheRef.current.has(prefetchKey)) return;

      folderPrefetchRef.current.schedule(prefetchKey, async () => {
        const live = prefetchContextRef.current;
        if (live.browseMode !== "folder" || live.tagFilter) return;

        const sharePrefetch = shouldSharePrefetch(id, live);
        const key = sharePrefetch
          ? `share:${live.collaborativeRootId}:${id}`
          : folderListingCacheKey(id, live.sort);

        if (sharePrefetch && live.collaborativeRootId) {
          const browseParent = id === live.collaborativeRootId ? undefined : id;
          const q = browseParent
            ? `?parentId=${encodeURIComponent(browseParent)}`
            : "";
          await tryRequest(`/api/share-folder/folders/${live.collaborativeRootId}/browse${q}`);
          return;
        }
        if (listingCacheRef.current.has(key)) return;
        const parentQ = id ? `?parentId=${encodeURIComponent(id)}` : "";
        const imgParams = new URLSearchParams();
        if (live.sort) imgParams.set("sort", live.sort);
        if (id) imgParams.set("folderId", id);
        const imgQ = imgParams.toString();
        const crumbQ = id ? `?folderId=${encodeURIComponent(id)}` : "";
        const [f, images, crumbsResult] = await Promise.all([
          tryRequest<FolderType[]>(`/api/folders${parentQ}`),
          tryRequest<ImageItem[]>(`/api/images${imgQ ? `?${imgQ}` : ""}`),
          tryRequest<Breadcrumb[]>(`/api/folders/breadcrumb${crumbQ}`),
        ]);
        if (!f || !images || !crumbsResult) return;
        listingCacheRef.current.set(key, {
          folders: f,
          images,
          crumbs: crumbsResult,
        });
      });
    },
    [shouldSharePrefetch],
  );

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const switchQuickAccess = useCallback(
    (mode: Exclude<BrowseMode, "folder">) => {
      contentLoadGenRef.current += 1;
      folderPrefetchRef.current.cancelAll();
      setShareBrowse(null);
      setFolderAccessReady(true);
      setBrowseMode(mode);
      setFolderId(undefined);
      setTagFilter(undefined);
      setContentLoading(true);
      closeSidebar();
    },
    [closeSidebar],
  );

  const navigateToFolder = useCallback(
    (id: string | undefined) => {
      contentLoadGenRef.current += 1;
      folderPrefetchRef.current.cancelAll();
      setBrowseMode("folder");
      setTagFilter(undefined);

      const sharedRootClick =
        id !== undefined && sharedEntries.some((e) => e.folder.id === id);
      const useShareListing = useCollaborativeBrowse || sharedRootClick;

      if (!useShareListing) {
        const optimisticCrumbs = buildBreadcrumbFromAllFolders(id, allFolders);
        setCrumbs(optimisticCrumbs);

        const cached = listingCacheRef.current.get(folderListingCacheKey(id, sort));
        if (cached) {
          setFolders(cached.folders);
          setImages(cached.images);
          if (cached.crumbs.length) setCrumbs(cached.crumbs);
          setContentLoading(false);
        } else {
          setFolders([]);
          setImages([]);
          setContentLoading(true);
        }
      } else {
        setFolders([]);
        setImages([]);
        setContentLoading(true);
      }

      setFolderId(id);
      closeSidebar();
    },
    [allFolders, sort, closeSidebar, useCollaborativeBrowse, sharedEntries],
  );

  const acceptIncomingInvite = useCallback(
    async (row: IncomingShareFolderInvite) => {
      const token = inviteTokenFromUrl(row.invite.inviteUrl);
      setAcceptingInviteId(row.invite.id);
      try {
        await api.acceptShareFolderInvite(token);
        toast.success(`Joined “${row.folder.name}”`);
        await reloadAll();
        void notifications.refresh();
        navigateToFolder(row.folder.id);
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not accept invite"));
      } finally {
        setAcceptingInviteId(null);
      }
    },
    [reloadAll, notifications, navigateToFolder],
  );

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, closeSidebar]);

  useEffect(() => {
    if (!folderAccessReady) return;
    loadMeta().catch((err) => {
      if (isSilentBrowseError(err)) return;
      toast.error("Failed to load folders");
    });
  }, [loadMeta, folderAccessReady]);

  useEffect(() => {
    if (!folderAccessReady) return;
    loadContents().catch((err) => {
      if (isSilentBrowseError(err)) return;
      toast.error("Failed to load files");
    });
  }, [loadContents, folderAccessReady]);

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
    selectedCount: selectedImageCount,
    isSelected: isImageSelected,
    handleSelectClick: onImageSelectClick,
    selectAll,
    clearSelection: clearImageSelection,
    idsForBulkAction,
    applyMarqueeSelection,
  } = useImageMultiSelect(filteredImages);

  const {
    isSelected: isFolderSelected,
    handleSelectClick: onFolderSelectClick,
    clearSelection: clearFolderSelection,
    selectedCount: selectedFolderCount,
  } = useFolderMultiSelect(filteredFolders);

  const handleFolderSelectClick = useCallback(
    (e: React.MouseEvent, folder: FolderType) => {
      clearImageSelection();
      onFolderSelectClick(e, folder);
    },
    [clearImageSelection, onFolderSelectClick],
  );

  const handleImageSelectClick = useCallback(
    (e: React.MouseEvent, img: ImageItem) => {
      clearFolderSelection();
      onImageSelectClick(e, img);
    },
    [clearFolderSelection, onImageSelectClick],
  );

  const clearAllSelection = useCallback(() => {
    clearImageSelection();
    clearFolderSelection();
  }, [clearImageSelection, clearFolderSelection]);

  const selectedCount = selectedImageCount;

  const openPreview = useCallback((img: ImageItem) => {
    setSelected(img);
  }, []);

  useEffect(() => {
    clearImageSelection();
    clearFolderSelection();
  }, [folderId, browseMode, tagFilter, clearImageSelection, clearFolderSelection]);

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

  const tagsByImageCount = useMemo(
    () =>
      [...allTags].sort(
        (a, b) => b.imageCount - a.imageCount || a.name.localeCompare(b.name),
      ),
    [allTags],
  );

  const canNewFolderHere = useMemo(
    () =>
      useCollaborativeBrowse
        ? browseMode === "folder"
        : canCreateFolderIn(folderId, allFolders),
    [useCollaborativeBrowse, browseMode, folderId, allFolders],
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
          prefetchImageBlob(imageFileSrc(prefetchImg.id));
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
    if (!useCollaborativeBrowse && !canCreateFolderIn(folderId, allFolders)) {
      toast.error(`Folders can be nested at most ${MAX_FOLDER_NESTING} levels deep`);
      return;
    }
    try {
      if (useCollaborativeBrowse && collaborativeRootId) {
        const parent = folderId ?? collaborativeRootId;
        await api.createShareFolderSubfolder(collaborativeRootId, name, parent);
      } else {
        await api.createFolder(name, folderId);
      }
      toast.success("Folder created");
      await reloadAll();
    } catch (err) {
      toast.error(apiErrorMessage(err, `Folders can be nested at most ${MAX_FOLDER_NESTING} levels deep`));
    }
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    const limit = uploadLimitForUser(user?.autoTagEnabled);
    const picked = Array.from(files);
    if (picked.length > limit) {
      toast.error(
        user?.autoTagEnabled
          ? `Auto-tagging is on — select at most ${limit} images to upload.`
          : `Select at most ${limit} images to upload.`,
      );
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const batch = picked;
    const total = batch.length;
    const uploadToastMessage = (current: number) =>
      total === 1 ? "Uploading 1 file…" : `Uploading ${current} of ${total} files…`;
    const t = toast.loading(uploadToastMessage(1));
    const uploadedIds: string[] = [];
    try {
      for (let i = 0; i < batch.length; i++) {
        const file = batch[i];
        toast.loading(uploadToastMessage(i + 1), { id: t });
        try {
          const img =
            useCollaborativeBrowse && collaborativeRootId
              ? await api.uploadShareFolderImage(
                  collaborativeRootId,
                  file,
                  folderId ?? collaborativeRootId,
                )
              : await api.uploadImage(file, browseMode === "folder" ? folderId : undefined);
          uploadedIds.push(img.id);
          addUploadedImageToState(img);
        } catch (err) {
          const reason = apiErrorMessage(err, "Upload failed");
          if (uploadedIds.length > 0) {
            toast.warning(`Uploaded ${uploadedIds.length} of ${total}, then failed`, {
              id: t,
              description: `${file.name}: ${reason}`,
            });
            void loadMeta();
            if (user?.autoTagEnabled) {
              startAutoTagWatch(uploadedIds);
            }
          } else {
            toast.error(`Upload failed: ${file.name}`, {
              id: t,
              description: reason,
            });
          }
          return;
        }
      }
      if (uploadedIds.length > 0) {
        toast.success(`Uploaded ${uploadedIds.length} file(s)`, { id: t });
        void loadMeta();
      }
      if (user?.autoTagEnabled) {
        startAutoTagWatch(uploadedIds);
      }
    } finally {
      if (fileRef.current) fileRef.current.value = "";
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
    clearImageSelection();
    await reloadAll();
  }

  async function copyImagesToFolder(imageIds: string[], targetFolderId: string | null) {
    const unique = [...new Set(imageIds)];
    if (!unique.length) return;

    let copied = 0;
    const destFolder = targetFolderId ?? "";
    for (const imageId of unique) {
      if (useCollaborativeBrowse && collaborativeRootId) {
        await api.copyShareFolderImage(imageId, destFolder || collaborativeRootId);
      } else {
        await api.copyImage(imageId, destFolder);
      }
      copied++;
    }

    if (copied === 0) return;
    toast.success(copied === 1 ? "Copied" : `Copied ${copied} items`);
    clearImageSelection();
    await reloadAll();
  }

  function openMoveDialog(contextImg?: ImageItem) {
    const ids = idsForBulkAction(contextImg?.id);
    if (!ids.length || browseMode === "trash") return;
    setBulkMoveIds(ids);
    setMoveTarget("root");
  }

  function openCopyDialog(contextImg?: ImageItem) {
    const ids = idsForBulkAction(contextImg?.id);
    if (!ids.length || browseMode === "trash") return;
    setBulkCopyIds(ids);
    setCopyTarget("root");
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
          clearImageSelection();
          toast.success("Permanently deleted");
          await reloadAll();
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
          if (useCollaborativeBrowse) {
            await api.deleteShareFolderImage(id);
          } else {
            await api.deleteImage(id);
          }
          if (selected?.id === id) setSelected(null);
        }
        clearImageSelection();
        toast.success(ids.length === 1 ? "Moved to trash" : `Moved ${ids.length} items to trash`);
        await reloadAll();
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
      if (e.key === "Escape" && (selectedImageCount > 0 || selectedFolderCount > 0)) {
        e.preventDefault();
        clearAllSelection();
        return;
      }
      if (e.key === "Delete" && selectedImageCount > 0) {
        e.preventDefault();
        askBulkTrash();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectAll, clearAllSelection, selectedImageCount, selectedFolderCount, browseMode, selected, idsForBulkAction]);

  async function moveFolderToParent(folderToMove: string, targetParentId: string | null) {
    await api.updateFolder(folderToMove, {
      parentId: targetParentId === null ? null : targetParentId,
    });
    toast.success("Folder moved");
    await reloadAll();
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

    if (wouldExceedFolderNesting(targetParentId, allFolders, dragged)) return false;

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
    if (wouldExceedFolderNesting(targetParentId, allFolders, dragged)) {
      return `Folders can be nested at most ${MAX_FOLDER_NESTING} levels deep`;
    }
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
    if (isImageCopyDrag(e)) {
      copyImagesToFolder(imageIds, targetParentId).catch(() => toast.error("Copy failed"));
    } else {
      moveImagesToFolder(imageIds, targetParentId).catch(() => toast.error("Move failed"));
    }
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
          await reloadAll();
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
        if (useCollaborativeBrowse) {
          await api.deleteShareFolderImage(id);
        } else {
          await api.deleteImage(id);
        }
        if (selected?.id === id) setSelected(null);
        toast.success("Moved to trash");
        await reloadAll();
      },
    });
  }

  function askEmptyTrash() {
    setConfirm({
      title: "Delete all items in trash?",
      message: `${images.length} item(s) will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete all",
      destructive: true,
      onConfirm: async () => {
        try {
          const { deleted } = await api.emptyTrash();
          setSelected(null);
          clearImageSelection();
          toast.success(deleted === 0 ? "Trash is already empty" : `Permanently deleted ${deleted} item(s)`);
          await reloadAll();
        } catch {
          toast.error("Failed to empty trash");
        }
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
          await reloadAll();
        } catch {
          toast.error("Failed to delete everything");
        }
      },
    });
  }

  async function restoreImage(id: string) {
    await api.restoreImage(id);
    toast.success("Restored");
    await reloadAll();
  }

  const addUploadedImageToState = useCallback(
    (img: ImageItem) => {
      const inFolder = (img.folderId ?? null) === (folderId ?? null);
      const matchesTag = tagFilter ? img.tags.includes(tagFilter) : true;

      if (browseMode === "timeline") {
        setTimelineGroups((prev) => insertImageIntoTimelineGroups(prev, img));
        void prefetchImageBlob(img.id);
        return;
      }

      if (browseMode === "favorites" || browseMode === "trash") return;
      if (browseMode === "folder" && tagFilter && !matchesTag) return;
      if (browseMode === "folder" && !tagFilter && !inFolder) return;

      setImages((prev) => insertImageSorted(prev, img, sort));

      if (browseMode === "folder" && !tagFilter) {
        const key = folderListingCacheKey(folderId, sort);
        const cached = listingCacheRef.current.get(key);
        if (cached) {
          listingCacheRef.current.set(key, {
            ...cached,
            images: insertImageSorted(cached.images, img, sort),
          });
        }
      }

      void prefetchImageBlob(img.id);
    },
    [browseMode, folderId, tagFilter, sort],
  );

  function patchImageInState(updated: ImageItem) {
    if (browseMode === "timeline") {
      setTimelineGroups((groups) =>
        groups.map((g) => ({
          ...g,
          images: g.images.map((i) => (i.id === updated.id ? updated : i)),
        })),
      );
      return;
    }

    if (browseMode === "favorites") {
      setImages((prev) => {
        if (!updated.favorite) {
          return prev.filter((i) => i.id !== updated.id);
        }
        if (prev.some((i) => i.id === updated.id)) {
          return prev.map((i) => (i.id === updated.id ? updated : i));
        }
        return [...prev, updated];
      });
      return;
    }

    setImages((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i)),
    );

    if (browseMode === "folder" && !tagFilter) {
      const key = folderListingCacheKey(folderId, sort);
      const cached = listingCacheRef.current.get(key);
      if (cached) {
        listingCacheRef.current.set(key, {
          ...cached,
          images: cached.images.map((i) =>
            i.id === updated.id ? updated : i,
          ),
        });
      }
    }
  }

  async function toggleFavorite(img: ImageItem) {
    const nextFavorite = !img.favorite;
    const optimistic = { ...img, favorite: nextFavorite };
    patchImageInState(optimistic);
    if (selected?.id === img.id) setSelected(optimistic);

    try {
      const updated = await api.updateImage(img.id, { favorite: nextFavorite });
      patchImageInState(updated);
      if (selected?.id === img.id) setSelected(updated);
      toast.success(
        updated.favorite ? "Added to favorites" : "Removed from favorites",
      );
    } catch {
      patchImageInState(img);
      if (selected?.id === img.id) setSelected(img);
      toast.error("Failed to update favorite");
    }
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
        await reloadAll(nextFolderId);
      },
    });
  }

  async function toggleVisibility(img: ImageItem) {
    const v = img.visibility === "public" ? "private" : "public";
    await api.updateImage(img.id, { visibility: v });
    toast.success(v === "public" ? "Now public" : "Now private");
    await reloadAll();
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
    await reloadAll();
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
      await reloadAll();
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
    if (useCollaborativeBrowse) return;

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
    if (isImageCopyDrag(e)) {
      copyImagesToFolder(imageIds, targetId).catch(() => toast.error("Copy failed"));
    } else {
      moveImagesToFolder(imageIds, targetId).catch(() => toast.error("Move failed"));
    }
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

    if (useCollaborativeBrowse) {
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
            <DropdownMenuItem onClick={() => openCopyDialog(img)}>
              <Files className="size-4" />
              Copy to…
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
          <DropdownMenuItem onClick={() => openCopyDialog(img)}>
            <Files className="size-4" />
            Copy to…
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
    if (useCollaborativeBrowse) {
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
            <DropdownMenuItem
              onClick={() =>
                void api.downloadShareFolderZip(folder.id).then(
                  () => toast.success("Download started"),
                  (err) => toast.error(apiErrorMessage(err, "Download failed")),
                )
              }
            >
              <Download className="size-4" />
              Download zip
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
          <DropdownMenuItem onClick={() => askRenameFolder(folder)}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const fromTree = allFolders.find((f) => f.id === folder.id);
              setShareSettingsFolder(
                fromTree
                  ? { ...folder, isShareFolder: fromTree.isShareFolder ?? folder.isShareFolder }
                  : folder,
              );
            }}
          >
            <Users className="size-4" />
            {folder.isShareFolder ? "Manage access" : "Share with others"}
          </DropdownMenuItem>
          {folder.isShareFolder ? (
            <DropdownMenuItem
              onClick={() =>
                void api.downloadShareFolderZip(folder.id).then(
                  () => toast.success("Download started"),
                  (err) => toast.error(apiErrorMessage(err, "Download failed")),
                )
              }
            >
              <Download className="size-4" />
              Download all (zip)
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => setPublicLinkFolder(folder)}>
            <Share2 className="size-4" />
            Public link…
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

  const showContentLoader = contentLoading || !folderAccessReady;

  const empty =
    !showContentLoader &&
    (browseMode === "timeline"
      ? false
      : browseMode === "folder"
        ? !filteredFolders.length && !filteredImages.length
        : !filteredImages.length);

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
  const uploadLimit = uploadLimitForUser(user?.autoTagEnabled);

  const showFavoriteStar = browseMode !== "trash" && !useCollaborativeBrowse;
  const folderOwnerLabel = userDisplayName(user);
  const posterLabelFor = useCallback(
    (img: ImageItem) => imagePosterLabel(img, folderOwnerLabel),
    [folderOwnerLabel],
  );

  return (
    <div
      className="flex h-dvh overflow-hidden bg-[var(--bg-primary)]"
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
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={closeSidebar}
        />
      ) : null}

      {/* Server rail */}
      <div className="hidden w-[72px] shrink-0 flex-col items-center gap-2 bg-[var(--bg-tertiary)] py-3 lg:flex">
        <div className="discord-rail-icon discord-rail-icon-active" title="image-storage">
          <ImageIcon className="size-6" />
        </div>
        <div className="discord-rail-icon" title="My Drive">
          <HardDrive className="size-5" />
        </div>
      </div>

      {/* Channel sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex min-h-0 w-[min(280px,85vw)] shrink-0 flex-col bg-[var(--bg-secondary)] shadow-xl transition-transform duration-200 ease-out lg:relative lg:z-auto lg:w-[240px] lg:translate-x-0 lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-12 items-center gap-2 border-b border-[var(--bg-tertiary)] px-4 shadow-sm">
          <h1 className="min-w-0 flex-1 truncate font-semibold text-[var(--header-primary)]">
            image-storage
          </h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 lg:hidden"
            aria-label="Close navigation"
            onClick={closeSidebar}
          >
            <X className="size-5" />
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-2 py-3">
          <div ref={sidebarRef}>
          <p className="discord-label mb-1 px-2">Quick access</p>
          <button
            type="button"
            className={cn(
              "discord-channel w-full text-left",
              browseMode === "folder" && !folderId && "discord-channel-active",
              sidebarDropHint?.targetId === "root" &&
                "bg-[#5865f2]/20 text-[var(--header-primary)]",
            )}
            onClick={() => {
              setShareBrowse(null);
              setFolderAccessReady(true);
              navigateToFolder(undefined);
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
            onClick={() => switchQuickAccess("favorites")}
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
            onClick={() => switchQuickAccess("timeline")}
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
            onClick={() => switchQuickAccess("trash")}
          >
            <Trash2 className="size-5 shrink-0 opacity-70" />
            Trash
          </button>

          <SidebarSection
            title="Folders"
            open={sidebarFoldersOpen}
            onToggle={() => setSidebarFoldersOpen((o) => !o)}
          >
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
                    "group discord-channel w-full items-center gap-0.5 pr-1",
                    DRIVE_SELECT_SURFACE,
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
                    className={cn(
                      DRIVE_OPEN_SURFACE,
                      "flex min-w-0 flex-1 items-center gap-1.5 border-0 bg-transparent p-0 text-left text-inherit outline-none",
                    )}
                    title={f.path}
                    onClick={() => navigateToFolder(f.id)}
                    onMouseEnter={() => prefetchFolderListing(f.id)}
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
                      "shrink-0 self-center opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100",
                      active && "md:opacity-100",
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
          </SidebarSection>

          {sharedEntries.length > 0 || incomingInvites.length > 0 ? (
            <SidebarSection
              title="Shared with me"
              open={sidebarSharedOpen}
              onToggle={() => setSidebarSharedOpen((o) => !o)}
              trailing={
                notifications.unreadCount > 0 ? (
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#f23f43] text-[10px] font-bold text-white"
                    aria-label={`${notifications.unreadCount} unread notification(s)`}
                  >
                    {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
                  </span>
                ) : null
              }
            >
              {incomingInvites.length > 0 ? (
                <div className="mb-2 px-1">
                  <ShareFolderInviteNotice
                    invites={incomingInvites}
                    acceptingInviteId={acceptingInviteId}
                    onAccept={(row) => void acceptIncomingInvite(row)}
                  />
                </div>
              ) : null}
              {sharedEntries.map((e) => (
                <button
                  key={e.folder.id}
                  type="button"
                  className={cn(
                    "discord-channel w-full text-left",
                    browseMode === "folder" && folderId === e.folder.id && "discord-channel-active",
                  )}
                  onClick={() => navigateToFolder(e.folder.id)}
                >
                  <Users className="size-5 shrink-0 text-[#5865f2]" />
                  <span className="truncate">{e.folder.name}</span>
                </button>
              ))}
            </SidebarSection>
          ) : null}
          </div>
        </ScrollArea>

      </aside>

      {/* Main content */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-[var(--bg-tertiary)] px-3 py-2 sm:gap-x-3 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 lg:hidden"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {browseMode === "folder" ? (
              <DriveBreadcrumbs crumbs={crumbs} onNavigate={navigateToFolder} />
            ) : (
              <>
                <HeaderIcon className="size-5 shrink-0 text-[#f0b232] sm:size-6" />
                <span className="truncate text-base font-normal text-[var(--header-primary)] sm:text-[20px]">
                  {locationLabel}
                </span>
              </>
            )}
            {selectedCount > 0 ? (
              <div
                className="hidden flex-wrap items-center gap-1.5 border-l border-[var(--border)] pl-3 md:flex"
                data-no-marquee
              >
                <span className="text-[13px] font-medium text-[var(--header-primary)]">
                  {selectedCount} selected
                </span>
                {browseMode !== "trash" ? (
                  <>
                    {!useCollaborativeBrowse ? (
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
                      onClick={() => openCopyDialog()}
                    >
                      <Files className="size-3.5" />
                      Copy
                    </Button>
                  </>
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
                  onClick={clearAllSelection}
                >
                  <X className="size-3.5" />
                  Clear
                </Button>
              </div>
            ) : null}
          </div>
          <span className="hidden text-[12px] text-[var(--muted-foreground)] lg:inline">
            {browseMode === "folder" ? `${filteredFolders.length} folders ` : ""}
            {imageCount} images
            {tagFilter ? `tag: ${tagFilter}` : ""}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
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
            <NotificationBell {...notifications} onNavigate={closeSidebar} />
            <ProfileMenu />
          </div>
        </header>

        <div className="flex flex-col gap-2 border-b border-[var(--bg-tertiary)] px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:px-4 sm:py-3">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                browseMode === "folder" ? "Search in folder" : `Search in ${locationLabel.toLowerCase()}`
              }
              className="h-8 w-full border-0 bg-[var(--input)] pl-8 text-[14px] rounded-[4px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {browseMode === "folder" ? (
              <Button
                size="sm"
                className="h-8 rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4]"
                disabled={!canNewFolderHere}
                title={
                  canNewFolderHere
                    ? undefined
                    : `Maximum folder nesting is ${MAX_FOLDER_NESTING} levels`
                }
                onClick={() => setNewFolderOpen(true)}
              >
                <FolderPlus className="size-4" />
                <span className="hidden sm:inline">New folder</span>
              </Button>
            ) : null}
            {browseMode === "trash" && images.length > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 rounded-[3px] text-[#f23f43] hover:bg-[#f23f43]/10 hover:text-[#f23f43]"
                onClick={askEmptyTrash}
              >
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">Delete all</span>
              </Button>
            ) : null}
            {allowUpload ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 rounded-[3px] bg-[#4e5058] hover:bg-[#6d6f78]"
                onClick={() => fileRef.current?.click()}
                title={`Upload up to ${uploadLimit} images${user?.autoTagEnabled ? " (auto-tagging on)" : ""}`}
              >
                <Upload className="size-4" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            ) : null}
            {useCollaborativeBrowse && collaborativeRootId && browseMode === "folder" ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-[3px]"
                onClick={() =>
                  void api
                    .downloadShareFolderZip(folderId ?? collaborativeRootId)
                    .then(
                      () => toast.success("Download started"),
                      (err) => toast.error(apiErrorMessage(err, "Download failed")),
                    )
                }
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Download zip</span>
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
            {browseMode === "folder" && !useCollaborativeBrowse && allTags.length > 0 ? (
              <Select
                value={tagFilter ?? "__all__"}
                onValueChange={(v) => setTagFilter(v === "__all__" ? undefined : v ?? undefined)}
              >
                <SelectTrigger className="hidden h-8 w-[130px] border-0 bg-[var(--input)] rounded-[4px] md:flex" size="sm">
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
                  {tagsByImageCount.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name} ({t.imageCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {browseMode !== "timeline" ? (
              <Select value={sort} onValueChange={(v) => v && setSort(v as Sort)}>
                <SelectTrigger className="hidden h-8 w-[110px] border-0 bg-[var(--input)] rounded-[4px] md:flex" size="sm">
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
              <div className="hidden gap-0.5 rounded-[4px] bg-[var(--bg-tertiary)] p-0.5 md:flex">
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
          {browseMode !== "timeline" ? (
            <div className="flex w-full flex-wrap items-center gap-2 md:hidden">
              <Select value={view} onValueChange={(v) => v && setView(v as ViewMode)}>
                <SelectTrigger className="h-8 min-w-0 flex-1 border-0 bg-[var(--input)] rounded-[4px]" size="sm">
                  <SelectValue placeholder="View">
                    {(value) =>
                      VIEW_OPTIONS.find((opt) => opt.value === value)?.label ?? "View"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {VIEW_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => v && setSort(v as Sort)}>
                <SelectTrigger className="h-8 w-[7.5rem] shrink-0 border-0 bg-[var(--input)] rounded-[4px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                </SelectContent>
              </Select>
              {browseMode === "folder" && allTags.length > 0 ? (
                <Select
                  value={tagFilter ?? "__all__"}
                  onValueChange={(v) => setTagFilter(v === "__all__" ? undefined : v ?? undefined)}
                >
                  <SelectTrigger className="h-8 min-w-0 flex-1 border-0 bg-[var(--input)] rounded-[4px]" size="sm">
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
                    {tagsByImageCount.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name} ({t.imageCount})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
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

        <ScrollArea className={cn("min-h-0 flex-1 px-3 py-3 sm:px-4", selectedCount > 0 && "pb-20 md:pb-3")}>
          <ImageMarqueeSurface
            disabled={empty || showContentLoader}
            onMarqueeSelect={applyMarqueeSelection}
            className="pb-2"
          >
          {showContentLoader ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="size-8 animate-spin text-[#5865f2]" />
            </div>
          ) : browseMode === "timeline" ? (
            <TimelineView
              groups={timelineGroups}
              openPreview={openPreview}
              isImageSelected={isImageSelected}
              onImageSelectClick={handleImageSelectClick}
              selectedImageIds={selectedImageIds}
              ImageThumb={BoundImageThumb}
              VisibilityBadge={DriveVisibilityBadge}
              posterLabelFor={posterLabelFor}
              showFavoriteStar={showFavoriteStar}
              onToggleFavorite={toggleFavorite}
              isImageTagging={isImageTagging}
              getTaggingElapsed={getTaggingElapsed}
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
              prefetchFolder={prefetchFolderListing}
              isFolderSelected={isFolderSelected}
              onFolderSelectClick={handleFolderSelectClick}
              openPreview={openPreview}
              isImageSelected={isImageSelected}
              onImageSelectClick={handleImageSelectClick}
              selectedImageIds={selectedImageIds}
              setDragOverFolder={setDragOverFolder}
              onFolderDrop={onFolderDrop}
              onFolderDragStart={onFolderDragStart}
              askRenameFolder={askRenameFolder}
              askRenameImage={askRenameImage}
              shareItem={shareItem}
              askDeleteFolder={askDeleteFolder}
              ImageThumb={BoundImageThumb}
              ImageMenu={ImageMenu}
              FolderMenu={FolderMenu}
              VisibilityBadge={DriveVisibilityBadge}
              showFavoriteStar={showFavoriteStar}
              folderOwnerLabel={folderOwnerLabel}
              posterLabelFor={posterLabelFor}
              onToggleFavorite={toggleFavorite}
              isImageTagging={isImageTagging}
              getTaggingElapsed={getTaggingElapsed}
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
              prefetchFolder={prefetchFolderListing}
              isFolderSelected={isFolderSelected}
              onFolderSelectClick={handleFolderSelectClick}
              openPreview={openPreview}
              isImageSelected={isImageSelected}
              onImageSelectClick={handleImageSelectClick}
              selectedImageIds={selectedImageIds}
              setDragOverFolder={setDragOverFolder}
              onFolderDrop={onFolderDrop}
              onFolderDragStart={onFolderDragStart}
              askRenameFolder={askRenameFolder}
              askRenameImage={askRenameImage}
              shareItem={shareItem}
              askDeleteFolder={askDeleteFolder}
              ImageThumb={BoundImageThumb}
              ImageMenu={ImageMenu}
              FolderMenu={FolderMenu}
              VisibilityBadge={DriveVisibilityBadge}
              showFavoriteStar={showFavoriteStar}
              folderOwnerLabel={folderOwnerLabel}
              posterLabelFor={posterLabelFor}
              onToggleFavorite={toggleFavorite}
              isImageTagging={isImageTagging}
              getTaggingElapsed={getTaggingElapsed}
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
              prefetchFolder={prefetchFolderListing}
              isFolderSelected={isFolderSelected}
              onFolderSelectClick={handleFolderSelectClick}
              openPreview={openPreview}
              isImageSelected={isImageSelected}
              onImageSelectClick={handleImageSelectClick}
              selectedImageIds={selectedImageIds}
              setDragOverFolder={setDragOverFolder}
              onFolderDrop={onFolderDrop}
              onFolderDragStart={onFolderDragStart}
              askRenameFolder={askRenameFolder}
              askRenameImage={askRenameImage}
              shareItem={shareItem}
              askDeleteFolder={askDeleteFolder}
              ImageThumb={BoundImageThumb}
              ImageMenu={ImageMenu}
              FolderMenu={FolderMenu}
              VisibilityBadge={DriveVisibilityBadge}
              showFavoriteStar={showFavoriteStar}
              folderOwnerLabel={folderOwnerLabel}
              posterLabelFor={posterLabelFor}
              onToggleFavorite={toggleFavorite}
              isImageTagging={isImageTagging}
              getTaggingElapsed={getTaggingElapsed}
            />
          )}
          </ImageMarqueeSurface>
        </ScrollArea>
      </main>

      {selectedCount > 0 ? (
        <div
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--bg-floating)] px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.24)] md:hidden"
          data-no-marquee
        >
          <span className="text-[13px] font-medium text-[var(--header-primary)]">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-1.5">
            {browseMode !== "trash" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 rounded-[3px] px-2 text-[12px]"
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
              className="h-8 rounded-[3px] px-2 text-[12px]"
              onClick={askBulkTrash}
            >
              <Trash2 className="size-3.5" />
              {browseMode === "trash" ? "Delete" : "Trash"}
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="rounded-[3px]"
              aria-label="Clear selection"
              onClick={clearAllSelection}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

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

      <ShareFolderSettings
        folder={shareSettingsFolder}
        open={!!shareSettingsFolder}
        onOpenChange={(o) => !o && setShareSettingsFolder(null)}
        onUpdated={reloadAll}
      />

      <PublicLinkDialog
        folder={publicLinkFolder}
        open={!!publicLinkFolder}
        onOpenChange={(o) => !o && setPublicLinkFolder(null)}
      />

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
              <div className="flex items-center gap-2 px-4 pt-4 pr-12 sm:px-6">
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <Label htmlFor="preview-name" className="sr-only">
                    File name
                  </Label>
                  <Input
                    id="preview-name"
                    value={previewName}
                    onChange={(e) => setPreviewName(e.target.value)}
                    disabled={browseMode === "trash"}
                    className="h-10 min-w-0 flex-1 rounded-[3px] border-0 bg-[var(--input)] text-base font-medium text-[var(--header-primary)] sm:text-[16px]"
                    onKeyDown={(e) => e.key === "Enter" && savePreviewChanges()}
                  />
                  <span className="shrink-0 px-1 text-[14px] text-[var(--muted-foreground)]">
                    {splitImageName(selected.name, selected.mimeType).extension}
                  </span>
                </div>
              </div>
              <div className="relative flex h-[min(58dvh,480px)] w-full shrink-0 items-center px-3 pt-3 sm:h-[min(50vh,400px)] sm:gap-2 sm:px-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute top-1/2 left-1 z-10 size-9 -translate-y-1/2 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)]/95 shadow-sm sm:static sm:size-10 sm:shrink-0 sm:translate-y-0 sm:bg-[var(--bg-secondary)]"
                  aria-label="Previous image"
                  disabled={!canGoPreviousImage}
                  onClick={selectPreviousImage}
                >
                  <ChevronLeft className="size-5 sm:size-6" />
                </Button>
                <div className="relative mx-auto flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-[4px] bg-[var(--bg-tertiary)]/30 px-10 sm:mx-0 sm:px-0">
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
                  <div className="relative min-h-0 flex-1">
                    {selected.visibility === "public" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={api.publicImageUrl(selected.id)}
                        alt={displayImageName(selected.name, selected.mimeType)}
                        className="absolute inset-0 size-full object-contain"
                      />
                    ) : (
                      <AuthImage
                        src={imageFileSrc(selected.id)}
                        alt={displayImageName(selected.name, selected.mimeType)}
                        className="absolute inset-0 object-contain"
                      />
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute top-1/2 right-1 z-10 size-9 -translate-y-1/2 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)]/95 shadow-sm sm:static sm:size-10 sm:shrink-0 sm:translate-y-0 sm:bg-[var(--bg-secondary)]"
                  aria-label="Next image"
                  disabled={!canGoNextImage}
                  onClick={selectNextImage}
                >
                  <ChevronRight className="size-5 sm:size-6" />
                </Button>
              </div>
              <div className="space-y-3 px-4 pb-4 pt-3 sm:px-6">
                {browseMode !== "trash" ? (
                  <>
                    <div>
                      <Label htmlFor="preview-tags" className="discord-label">
                        Tags
                      </Label>
                      {isImageTagging(selected.id) ? (
                        <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-[#5865f2]">
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          AI is tagging this image…
                          {getTaggingElapsed(selected.id) > 0
                            ? ` ${getTaggingElapsed(selected.id)}s`
                            : null}
                        </p>
                      ) : null}
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
                  {formatBytes(selected.size)} · {selected.visibility}
                  {selected.takenAt ? ` · ${new Date(selected.takenAt).toLocaleDateString()}` : ""}
                </p>
                <a
                  href={api.imageViewPath(selected.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-[#5865f2] underline hover:text-[#4752c4]"
                >
                  Open in new tab
                </a>
              </div>
              <DialogFooter className="gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-6 py-4 sm:justify-end">
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
        <DialogContent className="max-w-[440px] gap-0 overflow-hidden border-[var(--border)] bg-[var(--bg-primary)] p-0">
          <DialogHeader className="px-5 pt-5 pb-4">
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
          <div className="px-5 pb-5">
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
          </div>
          <DialogFooter className="gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4 sm:justify-end">
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

      <Dialog open={!!bulkCopyIds?.length} onOpenChange={(o) => !o && setBulkCopyIds(null)}>
        <DialogContent className="max-w-[440px] gap-0 overflow-hidden border-[var(--border)] bg-[var(--bg-primary)] p-0">
          <DialogHeader className="px-5 pt-5 pb-4">
            <DialogTitle className="text-[var(--header-primary)]">
              {bulkCopyIds && bulkCopyIds.length > 1
                ? `Copy ${bulkCopyIds.length} items`
                : bulkCopyIds?.[0]
                  ? `Copy "${displayImageName(
                      images.find((i) => i.id === bulkCopyIds[0])?.name ??
                        filteredImages.find((i) => i.id === bulkCopyIds[0])?.name ??
                        "",
                      images.find((i) => i.id === bulkCopyIds[0])?.mimeType ??
                        filteredImages.find((i) => i.id === bulkCopyIds[0])?.mimeType,
                    )}"`
                  : "Copy"}
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5">
            <Select value={copyTarget} onValueChange={(v) => v && setCopyTarget(v)}>
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
          </div>
          <DialogFooter className="gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4 sm:justify-end">
            <Button variant="secondary" className="rounded-[3px]" onClick={() => setBulkCopyIds(null)}>
              Cancel
            </Button>
            <Button
              className="rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4]"
              onClick={async () => {
                if (!bulkCopyIds?.length) return;
                const dest =
                  copyTarget === "root"
                    ? useCollaborativeBrowse && collaborativeRootId
                      ? collaborativeRootId
                      : null
                    : copyTarget;
                await copyImagesToFolder(bulkCopyIds, dest);
                setBulkCopyIds(null);
              }}
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
