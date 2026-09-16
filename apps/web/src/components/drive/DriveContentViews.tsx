"use client";

import { FolderOpen } from "lucide-react";
import { ImageThumbWithFavorite } from "@/components/drive/ImageThumbWithFavorite";
import { DriveSection } from "@/components/drive/DriveSection";
import {
  GRID_THUMB_CLASS,
  IMAGE_CARD_SELECT_BORDER_BASE,
  IMAGE_CARD_SELECTED_CLASS,
  VIEW_GRID,
  type ViewMode,
} from "@/components/drive/constants";
import { writeImageDragData } from "@/components/drive/image-drag";
import { DRIVE_IMAGE_SELECT_ATTR } from "@/components/drive/marquee-select";
import { ImageCardDetails } from "@/components/drive/ImageCardDetails";
import { formatDriveDate } from "@/components/drive/drive-format";
import { formatBytes } from "@/lib/api";
import { imageFileLabel } from "@/lib/image-name";
import type { Folder as FolderType, ImageItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export type DriveContentViewProps = {
  folders: FolderType[];
  images: ImageItem[];
  foldersOpen: boolean;
  imagesOpen: boolean;
  onToggleFolders: () => void;
  onToggleImages: () => void;
  dragOverFolder: string | null;
  setFolderId: (id: string | undefined) => void;
  openPreview: (img: ImageItem) => void;
  isImageSelected: (id: string) => boolean;
  onImageSelectClick: (e: React.MouseEvent, img: ImageItem) => void;
  selectedImageIds: ReadonlySet<string>;
  setDragOverFolder: (id: string | null) => void;
  onFolderDrop: (e: React.DragEvent, id: string | null) => void;
  onFolderDragStart: (e: React.DragEvent, id: string) => void;
  askRenameFolder: (folder: FolderType) => void;
  askRenameImage: (img: ImageItem) => void;
  shareItem: (type: "image" | "folder", id: string) => void;
  askDeleteFolder: (id: string, name: string) => void;
  ImageThumb: React.ComponentType<{ img: ImageItem; className?: string }>;
  ImageMenu: React.ComponentType<{ img: ImageItem }>;
  FolderMenu: React.ComponentType<{ folder: FolderType }>;
  VisibilityBadge: React.ComponentType<{ visibility: string }>;
  ownerLabel: string;
  showFavoriteStar: boolean;
  onToggleFavorite: (img: ImageItem) => void;
};

function ListTableHead() {
  return (
    <thead className="border-b border-[var(--border)] text-left text-[12px] font-medium text-[var(--header-secondary)]">
      <tr>
        <th className="px-3 py-2.5 font-medium">Name</th>
        <th className="hidden w-32 px-3 py-2.5 font-medium md:table-cell">Owner</th>
        <th className="hidden w-40 px-3 py-2.5 font-medium lg:table-cell">Last modified</th>
        <th className="hidden w-28 px-3 py-2.5 text-right font-medium sm:table-cell">File size</th>
        <th className="w-10 px-2 py-2.5" />
      </tr>
    </thead>
  );
}

export function GridView({
  view,
  folders,
  images,
  dragOverFolder,
  setFolderId,
  openPreview,
  isImageSelected,
  onImageSelectClick,
  selectedImageIds,
  setDragOverFolder,
  onFolderDrop,
  onFolderDragStart,
  askRenameFolder,
  askRenameImage,
  ImageThumb,
  ImageMenu,
  FolderMenu,
  VisibilityBadge,
  showFavoriteStar,
  ownerLabel,
  onToggleFavorite,
}: DriveContentViewProps & { view: ViewMode }) {
  const gridClass = VIEW_GRID[view as keyof typeof VIEW_GRID] ?? VIEW_GRID["grid-medium"];
  const thumbClass = GRID_THUMB_CLASS[view as keyof typeof GRID_THUMB_CLASS] ?? "";
  const compactFolders = view === "grid-small";

  return (
    <div className="space-y-4">
      {folders.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {folders.map((f) => (
            <div
              key={f.id}
              draggable
              onDragStart={(e) => onFolderDragStart(e, f.id)}
              className={cn(
                "group flex max-w-full cursor-grab items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] active:cursor-grabbing hover:bg-[var(--modifier-hover)]",
                compactFolders ? "h-9 px-2.5" : "h-10 min-w-[12rem] max-w-[16rem] px-3",
                dragOverFolder === f.id && "ring-2 ring-[#5865f2]",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverFolder(f.id);
              }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={(e) => onFolderDrop(e, f.id)}
            >
              <button
                type="button"
                onClick={() => setFolderId(f.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <FolderOpen className="size-5 shrink-0 text-[#9aa0a6]" />
                <span
                  className="truncate text-[13px] text-[var(--header-primary)]"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    askRenameFolder(f);
                  }}
                  title="Double-click to rename"
                >
                  {f.name}
                </span>
              </button>
              <div className="shrink-0 opacity-0 group-hover:opacity-100">
                <FolderMenu folder={f} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {images.length > 0 ? (
        <div className={cn("grid items-stretch p-2", gridClass)}>
          {images.map((img) => (
            <div
              key={img.id}
              {...{ [DRIVE_IMAGE_SELECT_ATTR]: img.id }}
              draggable
              onDragStart={(e) => writeImageDragData(e, img.id, selectedImageIds)}
              className={cn(
                "group flex h-full cursor-grab flex-col rounded-[8px] border-2 bg-[var(--bg-secondary)] p-2 transition-colors hover:bg-[#35373c] active:cursor-grabbing",
                IMAGE_CARD_SELECT_BORDER_BASE,
                isImageSelected(img.id) && IMAGE_CARD_SELECTED_CLASS,
              )}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => onImageSelectClick(e, img)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  openPreview(img);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    openPreview(img);
                  }
                }}
                className="flex flex-1 flex-col text-left outline-none focus:outline-none focus-visible:outline-none"
              >
                <ImageThumbWithFavorite
                  img={img}
                  className={cn("aspect-square w-full", thumbClass)}
                  ImageThumb={ImageThumb}
                  showFavorite={showFavoriteStar}
                  onToggleFavorite={onToggleFavorite}
                />
                <div
                  className="mt-2"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    askRenameImage(img);
                  }}
                  title="Double-click to rename"
                >
                  <ImageCardDetails
                    img={img}
                    ownerLabel={ownerLabel}
                    VisibilityBadge={VisibilityBadge}
                    compact
                  />
                </div>
              </div>
              <div className="mt-1 flex justify-end opacity-0 group-hover:opacity-100">
                <ImageMenu img={img} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ListView(p: DriveContentViewProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
      <table className="w-full text-[14px]">
        <ListTableHead />
        <tbody>
          {p.folders.map((f) => (
            <tr
              key={f.id}
              draggable
              onDragStart={(e) => p.onFolderDragStart(e, f.id)}
              className={cn(
                "group border-b border-[var(--border)]/60 transition-colors hover:bg-[var(--modifier-hover)]",
                "cursor-grab active:cursor-grabbing",
                p.dragOverFolder === f.id && "bg-[#5865f2]/10",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                p.setDragOverFolder(f.id);
              }}
              onDragLeave={() => p.setDragOverFolder(null)}
              onDrop={(e) => p.onFolderDrop(e, f.id)}
            >
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => p.setFolderId(f.id)}
                  className="flex min-w-0 items-center gap-3 text-[var(--header-primary)] hover:underline"
                >
                  <FolderOpen className="size-5 shrink-0 text-[#9aa0a6]" />
                  <span
                    className="truncate"
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      p.askRenameFolder(f);
                    }}
                    title="Double-click to rename"
                  >
                    {f.name}
                  </span>
                </button>
              </td>
              <td className="hidden px-3 py-2 text-[var(--muted-foreground)] md:table-cell">
                {p.ownerLabel}
              </td>
              <td className="hidden px-3 py-2 text-[var(--muted-foreground)] lg:table-cell">
                {formatDriveDate(f.updatedAt)}
              </td>
              <td className="hidden px-3 py-2 text-right text-[var(--muted-foreground)] sm:table-cell">—</td>
              <td className="px-2 py-2">
                <div className="opacity-0 group-hover:opacity-100">
                  <p.FolderMenu folder={f} />
                </div>
              </td>
            </tr>
          ))}
          {p.images.map((img) => (
            <tr
              key={img.id}
              {...{ [DRIVE_IMAGE_SELECT_ATTR]: img.id }}
              draggable
              onDragStart={(e) => writeImageDragData(e, img.id, p.selectedImageIds)}
              className={cn(
                "group cursor-grab border-b border-[var(--border)]/60 hover:bg-[var(--modifier-hover)] active:cursor-grabbing",
                p.isImageSelected(img.id) && "bg-[#5865f2]/15",
              )}
            >
              <td className="px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <ImageThumbWithFavorite
                    img={img}
                    className="size-6 shrink-0 rounded-sm"
                    ImageThumb={p.ImageThumb}
                    showFavorite={false}
                    onToggleFavorite={p.onToggleFavorite}
                  />
                  <button
                    type="button"
                    onClick={(e) => p.onImageSelectClick(e, img)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      p.openPreview(img);
                    }}
                    className="min-w-0 flex-1 truncate text-left text-[var(--header-primary)] hover:underline"
                  >
                    <span
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        p.askRenameImage(img);
                      }}
                      title="Double-click to rename"
                    >
                      {imageFileLabel(img.name, img.mimeType)}
                    </span>
                  </button>
                </div>
              </td>
              <td className="hidden px-3 py-2 text-[var(--muted-foreground)] md:table-cell">
                {p.ownerLabel}
              </td>
              <td className="hidden px-3 py-2 text-[var(--muted-foreground)] lg:table-cell">
                {formatDriveDate(img.createdAt)}
              </td>
              <td className="hidden px-3 py-2 text-right text-[var(--muted-foreground)] sm:table-cell">
                {formatBytes(img.size)}
              </td>
              <td className="px-2 py-2">
                <div className="opacity-0 group-hover:opacity-100">
                  <p.ImageMenu img={img} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DetailView(p: DriveContentViewProps) {
  return (
    <div className="space-y-5">
      {p.folders.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {p.folders.map((f) => (
            <div
              key={f.id}
              draggable
              onDragStart={(e) => p.onFolderDragStart(e, f.id)}
              className={cn(
                "group flex h-10 min-w-[12rem] max-w-[16rem] cursor-grab items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] px-3 active:cursor-grabbing hover:bg-[var(--modifier-hover)]",
                p.dragOverFolder === f.id && "ring-2 ring-[#5865f2]",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                p.setDragOverFolder(f.id);
              }}
              onDragLeave={() => p.setDragOverFolder(null)}
              onDrop={(e) => p.onFolderDrop(e, f.id)}
            >
              <button
                type="button"
                onClick={() => p.setFolderId(f.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <FolderOpen className="size-5 shrink-0 text-[#9aa0a6]" />
                <span className="truncate text-[13px]">{f.name}</span>
              </button>
              <p.FolderMenu folder={f} />
            </div>
          ))}
        </div>
      ) : null}

      <DriveSection
        title="Images"
        count={p.images.length}
        expanded={p.imagesOpen}
        onToggle={p.onToggleImages}
      >
        <div className="space-y-2">
          {p.images.map((img) => (
            <div
              key={img.id}
              {...{ [DRIVE_IMAGE_SELECT_ATTR]: img.id }}
              draggable
              onDragStart={(e) => writeImageDragData(e, img.id, p.selectedImageIds)}
              className={cn(
                "group flex flex-col gap-3 rounded-[8px] border-2 bg-[var(--bg-secondary)] p-4 sm:flex-row sm:items-center hover:bg-[#35373c]",
                IMAGE_CARD_SELECT_BORDER_BASE,
                p.isImageSelected(img.id) && IMAGE_CARD_SELECTED_CLASS,
              )}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => p.onImageSelectClick(e, img)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  p.openPreview(img);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    p.openPreview(img);
                  }
                }}
                className="shrink-0 cursor-pointer"
              >
                <ImageThumbWithFavorite
                  img={img}
                  className="size-28 rounded-[4px] sm:size-32"
                  ImageThumb={p.ImageThumb}
                  showFavorite={p.showFavoriteStar}
                  onToggleFavorite={p.onToggleFavorite}
                />
              </div>
              <div
                className="min-w-0 flex-1"
                onDoubleClick={() => p.askRenameImage(img)}
                title="Double-click to rename"
              >
                <ImageCardDetails
                  img={img}
                  ownerLabel={p.ownerLabel}
                  VisibilityBadge={p.VisibilityBadge}
                />
              </div>
              <p.ImageMenu img={img} />
            </div>
          ))}
        </div>
      </DriveSection>
    </div>
  );
}
