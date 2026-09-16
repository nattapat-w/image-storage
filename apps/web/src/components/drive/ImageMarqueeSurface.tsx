"use client";

import { useCallback, useRef, useState } from "react";
import {
  clientRectFromPoints,
  DRIVE_IMAGE_SELECT_ATTR,
  rectsIntersect,
} from "@/components/drive/marquee-select";
import { cn } from "@/lib/utils";

const MARQUEE_MIN_PX = 5;

type MarqueeBox = { x1: number; y1: number; x2: number; y2: number };

type ImageMarqueeSurfaceProps = {
  children: React.ReactNode;
  className?: string;
  onMarqueeSelect: (ids: string[], additive: boolean) => void;
  disabled?: boolean;
};

function isMarqueeBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  return Boolean(
    target.closest(
      "button, a, input, textarea, select, [role='menu'], [data-no-marquee], [contenteditable='true']",
    ),
  );
}

export function ImageMarqueeSurface({
  children,
  className,
  onMarqueeSelect,
  disabled = false,
}: ImageMarqueeSurfaceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<MarqueeBox | null>(null);
  const activeRef = useRef<{ additive: boolean } | null>(null);

  const finish = useCallback(
    (current: MarqueeBox, additive: boolean) => {
      const rect = clientRectFromPoints(current.x1, current.y1, current.x2, current.y2);
      const isTiny = rect.width < MARQUEE_MIN_PX && rect.height < MARQUEE_MIN_PX;

      if (isTiny) {
        if (!additive) onMarqueeSelect([], false);
        return;
      }

      const ids: string[] = [];
      rootRef.current
        ?.querySelectorAll(`[${DRIVE_IMAGE_SELECT_ATTR}]`)
        .forEach((node) => {
          const id = node.getAttribute(DRIVE_IMAGE_SELECT_ATTR);
          if (!id) return;
          if (rectsIntersect(node.getBoundingClientRect(), rect)) ids.push(id);
        });

      onMarqueeSelect(ids, additive);
    },
    [onMarqueeSelect],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    if (isMarqueeBlockedTarget(e.target)) return;
    if (e.target instanceof HTMLElement && e.target.closest(`[${DRIVE_IMAGE_SELECT_ATTR}]`)) {
      return;
    }

    e.preventDefault();
    const additive = e.metaKey || e.ctrlKey;
    activeRef.current = { additive };
    setBox({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeRef.current) return;
    setBox((prev) => (prev ? { ...prev, x2: e.clientX, y2: e.clientY } : null));
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeRef.current || !box) return;
    const { additive } = activeRef.current;
    finish(box, additive);
    activeRef.current = null;
    setBox(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const overlay = box ? clientRectFromPoints(box.x1, box.y1, box.x2, box.y2) : null;

  return (
    <div
      ref={rootRef}
      className={cn("relative min-h-full select-none", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {children}
      {overlay && (overlay.width >= MARQUEE_MIN_PX || overlay.height >= MARQUEE_MIN_PX) ? (
        <div
          className="pointer-events-none fixed z-[200] border border-[#5865f2] bg-[#5865f2]/20"
          style={{
            left: overlay.left,
            top: overlay.top,
            width: overlay.width,
            height: overlay.height,
          }}
        />
      ) : null}
    </div>
  );
}
