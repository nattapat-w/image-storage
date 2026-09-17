"use client";

import { FolderOpen } from "lucide-react";
import { FolderPill, FolderPillRow } from "@/components/drive/FolderPill";
import { ImageThumbWithFavorite } from "@/components/drive/ImageThumbWithFavorite";
import { DriveSection } from "@/components/drive/DriveSection";
import {
  DRIVE_OPEN_SURFACE,
  DRIVE_SELECT_SURFACE,
  GRID_THUMB_CLASS,
  IMAGE_CARD_SELECT_BORDER_BASE,
  IMAGE_CARD_SELECTED_CLASS,
  VIEW_GRID,
  type ViewMode,
} from "@/components/drive/constants";
import { writeImageDragData } from "@/components/drive/image-drag";
import { handleImageDoubleClick, handleImagePrimaryClick } from "@/components/drive/image-open";
import { DRIVE_FOLDER_SELECT_ATTR, DRIVE_IMAGE_SELECT_ATTR } from "@/components/drive/marquee-select";
import { ImageCardDetails } from "@/components/drive/ImageCardDetails";
import { formatDriveDate } from "@/components/drive/drive-format";
import { formatBytes } from "@/lib/api";
import { imageFileLabel } from "@/lib/image-name";
import { TruncatedFileName } from "@/components/drive/TruncatedFileName";
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
  prefetchFolder?: (id: string) => void;
  isFolderSelected: (id: string) => boolean;
  onFolderSelectClick: (e: React.MouseEvent, folder: FolderType) => void;
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
  folderOwnerLabel: string;
  posterLabelFor: (img: ImageItem) => string;
  showFavoriteStar: boolean;
  onToggleFavorite: (img: ImageItem) => void;
  isImageTagging?: (id: string) => boolean;
  getTaggingElapsed?: (id: string) => number;
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
  prefetchFolder,
  isFolderSelected,
  onFolderSelectClick,
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
  folderOwnerLabel,
  posterLabelFor,
  onToggleFavorite,
  isImageTagging,
  getTaggingElapsed,
}: DriveContentViewProps & { view: ViewMode }) {
  const gridClass = VIEW_GRID[view as keyof typeof VIEW_GRID] ?? VIEW_GRID["grid-medium"];
  const thumbClass = GRID_THUMB_CLASS[view as keyof typeof GRID_THUMB_CLASS] ?? "";
  return (
    <div>
      {folders.length > 0 ? (
        <FolderPillRow className={images.length > 0 ? "pb-0" : "pb-2"}>
          {folders.map((f) => (
            <FolderPill
              key={f.id}
              folder={f}
              isSelected={isFolderSelected(f.id)}
              isDropTarget={dragOverFolder === f.id}
              onSelectClick={(e) => onFolderSelectClick(e, f)}
              onOpen={() => setFolderId(f.id)}
              onPrefetch={prefetchFolder ? () => prefetchFolder(f.id) : undefined}
              onDragStart={(e) => onFolderDragStart(e, f.id)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverFolder(f.id);
              }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={(e) => onFolderDrop(e, f.id)}
              FolderMenu={FolderMenu}
            />
          ))}
        </FolderPillRow>
      ) : null}

      {images.length > 0 ? (
        <div
          className={cn(
            "grid items-stretch px-2 pb-2",
            folders.length > 0 ? "pt-2.5" : "pt-2",
            gridClass,
          )}
        >
          {images.map((img) => (
            <div
              key={img.id}
              {...{ [DRIVE_IMAGE_SELECT_ATTR]: img.id }}
              draggable
              onDragStart={(e) => writeImageDragData(e, img.id, selectedImageIds)}
              className={cn(
                "group flex h-full flex-col rounded-[8px] border-2 bg-[var(--bg-secondary)] p-2 transition-colors hover:bg-[#35373c]",
                DRIVE_SELECT_SURFACE,
                IMAGE_CARD_SELECT_BORDER_BASE,
                isImageSelected(img.id) && IMAGE_CARD_SELECTED_CLASS,
              )}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={(e) =>
                  handleImagePrimaryClick(e, img, onImageSelectClick, openPreview)
                }
                onDoubleClick={(e) => handleImageDoubleClick(e, img, openPreview)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    openPreview(img);
                  }
                }}
                className={cn(
                  DRIVE_SELECT_SURFACE,
                  "flex min-w-0 flex-1 flex-col text-left outline-none focus:outline-none focus-visible:outline-none",
                )}
              >
                <ImageThumbWithFavorite
                  img={img}
                  className={cn("aspect-square w-full", thumbClass)}
                  ImageThumb={ImageThumb}
                  showFavorite={showFavoriteStar}
                  onToggleFavorite={onToggleFavorite}
                />
                <div className="mt-2 min-w-0">
                  <ImageCardDetails
                    img={img}
                    ownerLabel={posterLabelFor(img)}
                    VisibilityBadge={VisibilityBadge}
                    compact
                    isTagging={isImageTagging?.(img.id)}
                    taggingElapsedSec={getTaggingElapsed?.(img.id)}
                    onOpenPreview={() => openPreview(img)}
                    onRename={() => askRenameImage(img)}
                  />
                </div>
              </div>
              <div className="mt-1 flex justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100">
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
    <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
      <table className="w-full min-w-[320px] text-[14px]">
        <ListTableHead />
        <tbody>
          {p.folders.map((f) => (
            <tr
              key={f.id}
              {...{ [DRIVE_FOLDER_SELECT_ATTR]: f.id }}
              draggable
              onDragStart={(e) => p.onFolderDragStart(e, f.id)}
              onClick={(e) => p.onFolderSelectClick(e, f)}
              onDoubleClick={(e) => {
                e.preventDefault();
                p.setFolderId(f.id);
              }}
              className={cn(
                "group border-b border-[var(--border)]/60 transition-colors hover:bg-[var(--modifier-hover)]",
                DRIVE_SELECT_SURFACE,
                p.isFolderSelected(f.id) && "bg-[#5865f2]/15",
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
                <div className="flex min-w-0 items-center gap-3 text-[var(--header-primary)]">
                  <FolderOpen className="size-5 shrink-0 text-[#9aa0a6]" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      p.setFolderId(f.id);
                    }}
                    className={cn(
                      DRIVE_OPEN_SURFACE,
                      "w-fit max-w-full min-w-0 truncate text-left hover:underline",
                    )}
                    title="Click to open folder"
                  >
                    {f.name}
                  </button>
                </div>
              </td>
              <td className="hidden px-3 py-2 text-[var(--muted-foreground)] md:table-cell">
                {p.folderOwnerLabel}
              </td>
              <td className="hidden px-3 py-2 text-[var(--muted-foreground)] lg:table-cell">
                {formatDriveDate(f.updatedAt)}
              </td>
              <td className="hidden px-3 py-2 text-right text-[var(--muted-foreground)] sm:table-cell">—</td>
              <td
                className="px-2 py-2"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100">
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
                "group border-b border-[var(--border)]/60 hover:bg-[var(--modifier-hover)]",
                DRIVE_SELECT_SURFACE,
                p.isImageSelected(img.id) && "bg-[#5865f2]/15",
              )}
            >
              <td className="px-3 py-2">
                <div
                  className={cn(DRIVE_SELECT_SURFACE, "flex min-w-0 items-center gap-3")}
                  onClick={(e) =>
                    handleImagePrimaryClick(e, img, p.onImageSelectClick, p.openPreview)
                  }
                  onDoubleClick={(e) => handleImageDoubleClick(e, img, p.openPreview)}
                >
                  <ImageThumbWithFavorite
                    img={img}
                    className="size-6 shrink-0 rounded-sm"
                    ImageThumb={p.ImageThumb}
                    showFavorite={false}
                    onToggleFavorite={p.onToggleFavorite}
                    compact
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      p.askRenameImage(img);
                    }}
                    className={cn(
                      DRIVE_OPEN_SURFACE,
                      "w-fit max-w-full min-w-0 text-left hover:underline",
                    )}
                    title="Double-click to rename"
                  >
                    <span className="block max-w-full truncate">
                      {imageFileLabel(img.name, img.mimeType)}
                    </span>
                  </button>
                </div>
              </td>
              <td className="hidden px-3 py-2 text-[var(--muted-foreground)] md:table-cell">
                {p.posterLabelFor(img)}
              </td>
              <td className="hidden px-3 py-2 text-[var(--muted-foreground)] lg:table-cell">
                {formatDriveDate(img.createdAt)}
              </td>
              <td className="hidden px-3 py-2 text-right text-[var(--muted-foreground)] sm:table-cell">
                {formatBytes(img.size)}
              </td>
              <td className="px-2 py-2">
                <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100">
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
        <FolderPillRow className="pb-2">
          {p.folders.map((f) => (
            <FolderPill
              key={f.id}
              folder={f}
              isSelected={p.isFolderSelected(f.id)}
              isDropTarget={p.dragOverFolder === f.id}
              onSelectClick={(e) => p.onFolderSelectClick(e, f)}
              onOpen={() => p.setFolderId(f.id)}
              onPrefetch={p.prefetchFolder ? () => p.prefetchFolder!(f.id) : undefined}
              onDragStart={(e) => p.onFolderDragStart(e, f.id)}
              onDragOver={(e) => {
                e.preventDefault();
                p.setDragOverFolder(f.id);
              }}
              onDragLeave={() => p.setDragOverFolder(null)}
              onDrop={(e) => p.onFolderDrop(e, f.id)}
              FolderMenu={p.FolderMenu}
            />
          ))}
        </FolderPillRow>
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
                DRIVE_SELECT_SURFACE,
                IMAGE_CARD_SELECT_BORDER_BASE,
                p.isImageSelected(img.id) && IMAGE_CARD_SELECTED_CLASS,
              )}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={(e) =>
                  handleImagePrimaryClick(e, img, p.onImageSelectClick, p.openPreview)
                }
                onDoubleClick={(e) => handleImageDoubleClick(e, img, p.openPreview)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    p.openPreview(img);
                  }
                }}
                className={cn(DRIVE_SELECT_SURFACE, "shrink-0")}
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
                  ownerLabel={p.posterLabelFor(img)}
                  VisibilityBadge={p.VisibilityBadge}
                  isTagging={p.isImageTagging?.(img.id)}
                  taggingElapsedSec={p.getTaggingElapsed?.(img.id)}
                  onOpenPreview={() => p.openPreview(img)}
                  onRename={() => p.askRenameImage(img)}
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
