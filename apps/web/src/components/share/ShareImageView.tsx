"use client";

import { Download } from "lucide-react";
import { AuthImage } from "@/components/AuthImage";
import { TruncatedFileName } from "@/components/drive/TruncatedFileName";
import { formatDriveDate } from "@/components/drive/drive-format";
import { DriveVisibilityBadge } from "@/components/drive/DriveVisibilityBadge";
import { Button } from "@/components/ui/button";
import { api, formatBytes } from "@/lib/api";
import { displayImageName } from "@/lib/image-name";
import type { ImageItem } from "@/lib/types";

type ShareImageViewProps = {
  img: ImageItem;
  token: string;
};

export function ShareImageView({ img, token }: ShareImageViewProps) {
  const fileUrl = api.imageFileUrl(img.id, token);
  const alt = displayImageName(img.name, img.mimeType);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-stretch lg:py-10">
      <div className="relative h-[55vh] min-h-[280px] w-full flex-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
        <AuthImage
          src={fileUrl}
          alt={alt}
          className="absolute inset-0 rounded-lg object-contain"
        />
      </div>

      <aside className="w-full shrink-0 lg:w-80 xl:w-96">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Shared image
          </p>
          <TruncatedFileName
            as="p"
            name={img.name}
            mimeType={img.mimeType}
            className="mt-2 font-heading text-lg font-semibold text-[var(--header-primary)]"
          />

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[11px] text-[var(--muted-foreground)]">Size</dt>
              <dd className="mt-0.5 text-[var(--header-secondary)]">{formatBytes(img.size)}</dd>
            </div>
            {img.createdAt ? (
              <div>
                <dt className="text-[11px] text-[var(--muted-foreground)]">Uploaded</dt>
                <dd className="mt-0.5 text-[var(--header-secondary)]">
                  {formatDriveDate(img.createdAt)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[11px] text-[var(--muted-foreground)]">Visibility</dt>
              <dd className="mt-1.5">
                <DriveVisibilityBadge visibility={img.visibility} />
              </dd>
            </div>
          </dl>

          {img.tags.length > 0 ? (
            <div className="mt-5">
              <p className="text-[11px] text-[var(--muted-foreground)]">Tags</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {img.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-[3px] border border-[var(--border)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[11px] text-[var(--header-secondary)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <Button className="mt-6 w-full" nativeButton={false} render={<a href={fileUrl} download={alt} />}>
            <Download aria-hidden />
            Download image
          </Button>
        </div>
      </aside>
    </div>
  );
}
