import type { ImageItem } from "@/lib/types";

/** Single click selects; double-click opens preview (works with draggable cards). */
export function handleImagePrimaryClick(
  e: React.MouseEvent,
  img: ImageItem,
  onSelect: (e: React.MouseEvent, img: ImageItem) => void,
  onOpenPreview: (img: ImageItem) => void,
) {
  if (e.detail >= 2) {
    e.preventDefault();
    e.stopPropagation();
    onOpenPreview(img);
    return;
  }
  onSelect(e, img);
}

export function handleImageDoubleClick(
  e: React.MouseEvent,
  img: ImageItem,
  onOpenPreview: (img: ImageItem) => void,
) {
  e.preventDefault();
  e.stopPropagation();
  onOpenPreview(img);
}
