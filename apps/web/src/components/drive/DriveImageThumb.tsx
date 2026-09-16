"use client";

import { memo } from "react";
import { AuthImage } from "@/components/AuthImage";
import { api } from "@/lib/api";
import { displayImageName } from "@/lib/image-name";
import type { ImageItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type DriveImageThumbProps = {
  img: ImageItem;
  className?: string;
  shareToken?: string;
};

function DriveImageThumbComponent({ img, className, shareToken }: DriveImageThumbProps) {
  if (img.visibility === "public" && !shareToken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={api.publicImageUrl(img.id)}
        alt={displayImageName(img.name, img.mimeType)}
        className={cn("rounded-[4px] object-cover", className)}
      />
    );
  }

  return (
    <AuthImage
      src={api.imageFileUrl(img.id, shareToken)}
      alt={displayImageName(img.name, img.mimeType)}
      className={cn("rounded-[4px] object-cover", className)}
    />
  );
}

export const DriveImageThumb = memo(
  DriveImageThumbComponent,
  (prev, next) =>
    prev.img.id === next.img.id &&
    prev.img.visibility === next.img.visibility &&
    prev.shareToken === next.shareToken &&
    prev.className === next.className,
);
