"use client";

import { useEffect } from "react";
import { Download, X } from "lucide-react";
import { AuthImage } from "@/components/AuthImage";
import { TruncatedFileName } from "@/components/drive/TruncatedFileName";
import { formatDriveDate } from "@/components/drive/drive-format";
import { Button } from "@/components/ui/button";
import { api, formatBytes } from "@/lib/api";
import { displayImageName } from "@/lib/image-name";
import type { ImageItem } from "@/lib/types";

type ShareImagePreviewProps = {
  img: ImageItem;
  token: string;
  onClose: () => void;
};

export function ShareImagePreview({ img, token, onClose }: ShareImagePreviewProps) {
  const fileUrl = api.imageFileUrl(img.id, token);
  const alt = displayImageName(img.name, img.mimeType);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <TruncatedFileName
            as="p"
            name={img.name}
            mimeType={img.mimeType}
            className="font-medium text-[var(--header-primary)]"
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            {formatBytes(img.size)}
            {img.createdAt ? ` · ${formatDriveDate(img.createdAt)}` : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<a href={fileUrl} download={alt} />}>
            <Download aria-hidden />
            Download
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close preview">
            <X aria-hidden />
          </Button>
        </div>
      </div>
      <button
        type="button"
        className="relative min-h-0 flex-1 w-full"
        onClick={onClose}
        aria-label="Close preview"
      >
        <AuthImage
          src={fileUrl}
          alt={alt}
          className="absolute inset-0 object-contain"
        />
      </button>
    </div>
  );
}
