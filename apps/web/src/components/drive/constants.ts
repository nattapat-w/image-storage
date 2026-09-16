/** MIME type keys for internal drag-and-drop (images / folders). */
export const DRAG_TYPE = "application/x-image-storage-image";
export const FOLDER_DRAG_TYPE = "application/x-image-storage-folder";

export type Sort = "name" | "date" | "size";

export type ViewMode = "grid-large" | "grid-medium" | "grid-small" | "list" | "detail";

type GridViewMode = Exclude<ViewMode, "list" | "detail">;

export const VIEW_GRID: Record<GridViewMode, string> = {
  "grid-large": "grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  "grid-medium": "grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
  "grid-small": "grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10",
};

export const GRID_THUMB_CLASS: Record<GridViewMode, string> = {
  "grid-large": "rounded-[6px]",
  "grid-medium": "rounded-[4px]",
  "grid-small": "rounded-[3px]",
};

/** Reserved border slot on cards; selected swaps color (stays inside — no neighbor overlap). */
export const IMAGE_CARD_SELECT_BORDER_BASE = "border-2 border-transparent";
export const IMAGE_CARD_SELECTED_CLASS = "border-[#5865f2]";
