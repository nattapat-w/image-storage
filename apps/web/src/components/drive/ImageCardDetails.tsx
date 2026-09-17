"use client";

import { Loader2 } from "lucide-react";
import { formatDriveDate } from "@/components/drive/drive-format";
import { DRIVE_OPEN_SURFACE } from "@/components/drive/constants";
import { formatBytes } from "@/lib/api";
import { imageFileLabel } from "@/lib/image-name";
import { TruncatedFileName } from "@/components/drive/TruncatedFileName";
import type { ImageItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type ImageCardDetailsProps = {
  img: ImageItem;
  ownerLabel: string;
  VisibilityBadge: React.ComponentType<{ visibility: string }>;
  compact?: boolean;
  className?: string;
  isTagging?: boolean;
  taggingElapsedSec?: number;
  onOpenPreview?: () => void;
  onRename?: () => void;
};

export function ImageCardDetails({
  img,
  ownerLabel,
  VisibilityBadge,
  compact = false,
  className,
  isTagging = false,
  taggingElapsedSec,
  onOpenPreview,
  onRename,
}: ImageCardDetailsProps) {
  const nameClassName = cn(
    "font-medium text-[var(--header-primary)]",
    compact ? "text-[13px]" : "text-[16px]",
  );

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        compact ? "min-h-[5.75rem]" : "min-h-[6.25rem]",
        className,
      )}
    >
      {onOpenPreview ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onOpenPreview();
          }}
          className={cn(
            DRIVE_OPEN_SURFACE,
            "w-fit max-w-full min-w-0 text-left hover:underline",
            nameClassName,
          )}
          title={imageFileLabel(img.name, img.mimeType)}
        >
          <span className="block max-w-full truncate">
            {imageFileLabel(img.name, img.mimeType)}
          </span>
        </button>
      ) : (
        <TruncatedFileName as="p" name={img.name} mimeType={img.mimeType} className={nameClassName} />
      )}
      <p className="mt-1.5 shrink-0 text-[11px] text-[var(--muted-foreground)]">
        Posted by{" "}
        <span className="text-[var(--header-secondary)]">{ownerLabel}</span>
        <span aria-hidden> · </span>
        <time dateTime={img.createdAt}>{formatDriveDate(img.createdAt)}</time>
      </p>
      <div className="mt-1 shrink-0">
        <VisibilityBadge visibility={img.visibility} />
      </div>
      {isTagging ? (
        <p className="mt-2.5 inline-flex items-center gap-1 text-[10px] text-[#5865f2]">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          AI tagging…
          {taggingElapsedSec != null && taggingElapsedSec > 0 ? ` ${taggingElapsedSec}s` : null}
        </p>
      ) : img.tags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1 overflow-hidden">
          {img.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-[3px] border border-[var(--border)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] leading-tight text-[var(--header-secondary)]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-auto shrink-0 pt-1.5 text-[11px] text-[var(--muted-foreground)]">
        {formatBytes(img.size)}
      </p>
    </div>
  );
}
