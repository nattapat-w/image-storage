import { DRAG_TYPE } from "@/components/drive/constants";

export const IMAGES_DRAG_TYPE = "application/x-image-storage-images";

export function writeImageDragData(
  e: React.DragEvent,
  primaryId: string,
  selectedIds: ReadonlySet<string>,
) {
  const ids =
    selectedIds.has(primaryId) && selectedIds.size > 1 ? Array.from(selectedIds) : [primaryId];
  e.dataTransfer.setData(DRAG_TYPE, ids[0]);
  e.dataTransfer.setData(IMAGES_DRAG_TYPE, JSON.stringify(ids));
  e.dataTransfer.setData("text/plain", ids.join(","));
  e.dataTransfer.effectAllowed = "move";
}

export function readImageDragIds(e: React.DragEvent): string[] {
  const multi = e.dataTransfer.getData(IMAGES_DRAG_TYPE);
  if (multi) {
    try {
      const parsed = JSON.parse(multi) as unknown;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string") && parsed.length) {
        return parsed;
      }
    } catch {
      /* fall through */
    }
  }
  const single = e.dataTransfer.getData(DRAG_TYPE);
  return single ? [single] : [];
}

export function dragIncludesImages(e: React.DragEvent): boolean {
  return (
    e.dataTransfer.types.includes(DRAG_TYPE) || e.dataTransfer.types.includes(IMAGES_DRAG_TYPE)
  );
}
