export function rectsIntersect(a: DOMRect, b: DOMRect): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export function clientRectFromPoints(x1: number, y1: number, x2: number, y2: number): DOMRect {
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);
  return new DOMRect(left, top, width, height);
}

export const DRIVE_IMAGE_SELECT_ATTR = "data-drive-image-id";
