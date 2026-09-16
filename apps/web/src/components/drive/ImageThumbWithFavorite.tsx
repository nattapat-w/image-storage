"use client";

import { Star } from "lucide-react";
import type { ImageItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImageThumbWithFavoriteProps = {
  img: ImageItem;
  className?: string;
  ImageThumb: React.ComponentType<{ img: ImageItem; className?: string }>;
  showFavorite: boolean;
  onToggleFavorite: (img: ImageItem) => void;
  /** Compact star for small list thumbnails */
  compact?: boolean;
};

export function ImageThumbWithFavorite({
  img,
  className,
  ImageThumb,
  showFavorite,
  onToggleFavorite,
  compact = false,
}: ImageThumbWithFavoriteProps) {
  if (!showFavorite) {
    return <ImageThumb img={img} className={className} />;
  }

  return (
    <div className="relative inline-block max-w-full">
      <ImageThumb img={img} className={className} />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title={img.favorite ? "Remove from favorites" : "Add to favorites"}
        className={cn(
          "absolute z-10 rounded-full bg-[var(--bg-floating)]/90 shadow-sm",
          "opacity-0 transition-opacity group-hover:opacity-100",
          img.favorite && "opacity-100",
          compact ? "top-0.5 right-0.5 size-5" : "top-1.5 right-1.5 size-7",
        )}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggleFavorite(img);
        }}
      >
        <Star
          className={cn(
            compact ? "size-3" : "size-4",
            img.favorite ? "fill-[#f0b232] text-[#f0b232]" : "text-[var(--header-primary)]",
          )}
        />
      </Button>
    </div>
  );
}
