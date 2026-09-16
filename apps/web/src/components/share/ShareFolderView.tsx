"use client";

import { useState } from "react";
import { FolderOpen, ImageIcon } from "lucide-react";
import { AuthImage } from "@/components/AuthImage";
import { TruncatedFileName } from "@/components/drive/TruncatedFileName";
import { folderStatsLabel } from "@/components/drive/drive-format";
import { ShareImagePreview } from "@/components/share/ShareImagePreview";
import { api } from "@/lib/api";
import { displayImageName } from "@/lib/image-name";
import type { Folder, ImageItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type ShareFolderViewProps = {
  folders: Folder[];
  images: ImageItem[];
  token: string;
};

export function ShareFolderView({ folders, images, token }: ShareFolderViewProps) {
  const [preview, setPreview] = useState<ImageItem | null>(null);
  const totalItems = folders.length + images.length;

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="font-heading text-xl font-semibold text-[var(--header-primary)] sm:text-2xl">
            Shared folder
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {totalItems === 0
              ? "This folder is empty."
              : `${folders.length} folder${folders.length === 1 ? "" : "s"} · ${images.length} image${images.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {folders.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Folders
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#f0b232]/15">
                    <FolderOpen className="size-5 text-[#f0b232]" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--header-primary)]">
                      {folder.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                      {folderStatsLabel(folder.imageCount, folder.totalSize)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {images.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Images
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setPreview(img)}
                  className={cn(
                    "group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-left",
                    "transition-colors hover:border-[#5865f2]/40 hover:bg-[var(--modifier-hover)]",
                  )}
                >
                  <div className="relative aspect-square overflow-hidden bg-[var(--bg-tertiary)]">
                    <AuthImage
                      src={api.imageFileUrl(img.id, token)}
                      alt={displayImageName(img.name, img.mimeType)}
                      className="absolute inset-0 object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="px-2.5 py-2">
                    <TruncatedFileName
                      as="p"
                      name={img.name}
                      mimeType={img.mimeType}
                      className="text-xs font-medium text-[var(--header-primary)]"
                    />
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] px-6 py-16 text-center">
            <ImageIcon className="size-10 text-[var(--muted-foreground)]" aria-hidden />
            <p className="mt-3 text-sm font-medium text-[var(--header-secondary)]">
              Nothing to show yet
            </p>
            <p className="mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">
              This shared folder does not contain any images or subfolders.
            </p>
          </div>
        ) : null}
      </div>

      {preview ? (
        <ShareImagePreview img={preview} token={token} onClose={() => setPreview(null)} />
      ) : null}
    </>
  );
}
