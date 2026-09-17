"use client";

import { FolderOpen } from "lucide-react";
import { folderStatsLabel } from "@/components/drive/drive-format";
import { DRIVE_OPEN_SURFACE, DRIVE_SELECT_SURFACE } from "@/components/drive/constants";
import { DriveShareFolderBadge } from "@/components/drive/DriveShareFolderBadge";
import { DRIVE_FOLDER_SELECT_ATTR } from "@/components/drive/marquee-select";
import type { Folder as FolderType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const FOLDER_PILL_CLASS =
  "min-h-14 w-full max-w-full shrink-0 gap-3 rounded-xl bg-[var(--bg-secondary)] py-2.5 pl-3.5 pr-2 shadow-sm sm:w-[16rem] sm:max-w-[calc(50%-0.375rem)] lg:max-w-none";

type FolderPillProps = {
  folder: FolderType;
  isSelected: boolean;
  isDropTarget: boolean;
  onSelectClick: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onPrefetch?: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  FolderMenu: React.ComponentType<{ folder: FolderType }>;
  className?: string;
};

export function FolderPillRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("flex flex-wrap gap-3 px-2 pt-2", className)}>{children}</div>;
}

export function FolderPill({
  folder,
  isSelected,
  isDropTarget,
  onSelectClick,
  onOpen,
  onPrefetch,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  FolderMenu,
  className,
}: FolderPillProps) {
  const stats = folderStatsLabel(folder.imageCount, folder.totalSize);

  return (
    <div
      {...{ [DRIVE_FOLDER_SELECT_ATTR]: folder.id }}
      draggable
      onDragStart={onDragStart}
      className={cn(
        "group flex items-center transition-[background-color,box-shadow,border-color] hover:bg-[var(--modifier-hover)] hover:shadow-md",
        DRIVE_SELECT_SURFACE,
        FOLDER_PILL_CLASS,
        "border-2",
        isSelected ? "border-[#5865f2]" : "border-[var(--border)]",
        isDropTarget &&
          "border-[#5865f2]/60 ring-2 ring-[#5865f2] ring-offset-1 ring-offset-[var(--bg-primary)]",
        className,
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSelectClick}
        onDoubleClick={(e) => {
          e.preventDefault();
          onOpen();
        }}
        onMouseEnter={onPrefetch}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onOpen();
          }
        }}
        title={`${folder.name} · ${stats}`}
        className={cn(
          DRIVE_SELECT_SURFACE,
          "flex min-h-0 min-w-0 flex-1 self-stretch items-center gap-3 rounded-lg py-0.5 text-left outline-none focus:outline-none focus-visible:outline-none",
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f0b232]/15">
          <FolderOpen className="size-[18px] text-[#f0b232]" />
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpen();
              }}
              className={cn(
                DRIVE_OPEN_SURFACE,
                "max-w-full min-w-0 truncate text-left text-[13px] leading-5 font-medium text-[var(--header-primary)] hover:underline",
              )}
              title="Click to open folder"
            >
              {folder.name}
            </button>
            {folder.isShareFolder ? <DriveShareFolderBadge /> : null}
          </div>
          <span className="mt-0.5 block truncate text-[10px] leading-4 text-[var(--muted-foreground)]">
            {stats}
          </span>
        </div>
      </div>
      <div
        className="shrink-0 self-center pl-1 pr-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <FolderMenu folder={folder} />
      </div>
    </div>
  );
}
