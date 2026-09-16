export const UPLOAD_LIMIT_WITH_AUTO_TAG = 5;
export const UPLOAD_LIMIT_DEFAULT = 100;

export function uploadLimitForUser(autoTagEnabled?: boolean) {
  return autoTagEnabled ? UPLOAD_LIMIT_WITH_AUTO_TAG : UPLOAD_LIMIT_DEFAULT;
}

/** MIME type keys for internal drag-and-drop (images / folders). */
export const DRAG_TYPE = "application/x-image-storage-image";
export const FOLDER_DRAG_TYPE = "application/x-image-storage-folder";

export type Sort = "name" | "date" | "size";

export type ViewMode = "grid-large" | "grid-medium" | "grid-small" | "list" | "detail";

export const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "grid-large", label: "Large icons" },
  { value: "grid-medium", label: "Medium icons" },
  { value: "grid-small", label: "Small icons" },
  { value: "list", label: "List" },
  { value: "detail", label: "Details" },
];

type GridViewMode = Exclude<ViewMode, "list" | "detail">;

export const VIEW_GRID: Record<GridViewMode, string> = {
  "grid-large": "grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  "grid-medium": "grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
  "grid-small": "grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
};

export const GRID_THUMB_CLASS: Record<GridViewMode, string> = {
  "grid-large": "rounded-[6px]",
  "grid-medium": "rounded-[4px]",
  "grid-small": "rounded-[3px]",
};

/** Reserved border slot on cards; selected swaps color (stays inside — no neighbor overlap). */
export const IMAGE_CARD_SELECT_BORDER_BASE = "border-2 border-transparent";
export const IMAGE_CARD_SELECTED_CLASS = "border-[#5865f2]";

/** Primary click selects or drags; not an open action. */
export const DRIVE_SELECT_SURFACE = "cursor-default!";

/** Primary click opens or navigates. */
export const DRIVE_OPEN_SURFACE = "cursor-pointer";
