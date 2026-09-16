"use client";

import { formatDriveDate } from "@/components/drive/drive-format";
import { formatBytes } from "@/lib/api";
import { imageFileLabel } from "@/lib/image-name";
import type { ImageItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type ImageCardDetailsProps = {
  img: ImageItem;
  ownerLabel: string;
  VisibilityBadge: React.ComponentType<{ visibility: string }>;
  compact?: boolean;
  className?: string;
};

export function ImageCardDetails({
  img,
  ownerLabel,
  VisibilityBadge,
  compact = false,
  className,
}: ImageCardDetailsProps) {
  const fileName = imageFileLabel(img.name, img.mimeType);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        compact ? "min-h-[5.75rem]" : "min-h-[6.25rem]",
        className,
      )}
    >
      <p
        className={cn(
          "line-clamp-1 shrink-0 font-medium text-[var(--header-primary)]",
          compact ? "text-[13px]" : "text-[16px]",
        )}
        title={fileName}
      >
        {fileName}
      </p>
      <p className="mt-1.5 shrink-0 text-[11px] text-[var(--muted-foreground)]">
        Posted by{" "}
        <span className="text-[var(--header-secondary)]">{ownerLabel}</span>
        <span aria-hidden> · </span>
        <time dateTime={img.createdAt}>{formatDriveDate(img.createdAt)}</time>
      </p>
      <div className="mt-1 shrink-0">
        <VisibilityBadge visibility={img.visibility} />
      </div>
      {img.tags.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1 overflow-hidden">
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
