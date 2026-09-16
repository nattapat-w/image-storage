"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Folder as FolderType } from "@/lib/types";

export function useFolderMultiSelect(orderedFolders: FolderType[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const anchorRef = useRef<string | null>(null);

  const orderedIds = useMemo(() => orderedFolders.map((f) => f.id), [orderedFolders]);

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
    (e: React.MouseEvent, folder: FolderType) => {
      const mod = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;

      if (shift && anchorRef.current) {
        const a = orderedIds.indexOf(anchorRef.current);
        const b = orderedIds.indexOf(folder.id);
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
          if (next.has(folder.id)) next.delete(folder.id);
          else next.add(folder.id);
          return next;
        });
        anchorRef.current = folder.id;
        return;
      }

      setSelectedIds(new Set([folder.id]));
      anchorRef.current = folder.id;
    },
    [orderedIds],
  );

  return {
    selectedFolderIds: selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    handleSelectClick,
    clearSelection,
  };
}
