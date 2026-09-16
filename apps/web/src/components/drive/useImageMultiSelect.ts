"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImageItem } from "@/lib/types";

export function useImageMultiSelect(orderedImages: ImageItem[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const anchorRef = useRef<string | null>(null);

  const orderedIds = useMemo(() => orderedImages.map((i) => i.id), [orderedImages]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    anchorRef.current = null;
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(orderedIds);
      const next = new Set([...prev].filter((id) => valid.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [orderedIds]);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const handleSelectClick = useCallback(
    (e: React.MouseEvent, img: ImageItem) => {
      const mod = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;

      if (shift && anchorRef.current) {
        const a = orderedIds.indexOf(anchorRef.current);
        const b = orderedIds.indexOf(img.id);
        if (a >= 0 && b >= 0) {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const range = orderedIds.slice(lo, hi + 1);
          setSelectedIds((prev) => {
            const next = mod ? new Set(prev) : new Set<string>();
            for (const id of range) next.add(id);
            return next;
          });
          return;
        }
      }

      if (mod) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(img.id)) next.delete(img.id);
          else next.add(img.id);
          return next;
        });
        anchorRef.current = img.id;
        return;
      }

      setSelectedIds(new Set([img.id]));
      anchorRef.current = img.id;
    },
    [orderedIds],
  );

  const selectAll = useCallback(() => {
    if (!orderedIds.length) return;
    setSelectedIds(new Set(orderedIds));
    anchorRef.current = orderedIds[orderedIds.length - 1] ?? null;
  }, [orderedIds]);

  const idsForBulkAction = useCallback(
    (contextId?: string) => {
      if (contextId && selectedIds.has(contextId) && selectedIds.size > 1) {
        return Array.from(selectedIds);
      }
      if (contextId) return [contextId];
      return Array.from(selectedIds);
    },
    [selectedIds],
  );

  const applyMarqueeSelection = useCallback(
    (ids: string[], additive: boolean) => {
      if (!ids.length) {
        if (!additive) clearSelection();
        return;
      }
      setSelectedIds((prev) => {
        const next = additive ? new Set(prev) : new Set<string>();
        for (const id of ids) next.add(id);
        return next;
      });
      anchorRef.current = ids[ids.length - 1] ?? null;
    },
    [clearSelection],
  );

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    handleSelectClick,
    selectAll,
    clearSelection,
    idsForBulkAction,
    applyMarqueeSelection,
  };
}
