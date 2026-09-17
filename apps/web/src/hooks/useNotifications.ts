"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AppNotification } from "@/lib/types";

export function useNotifications(enabled = true) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const list = await api.listNotifications();
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return;
    const timer = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  const unreadCount = items.filter((n) => !n.read).length;

  const markRead = useCallback(
    async (id: string) => {
      await api.markNotificationRead(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    await api.markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return { items, unreadCount, loading, refresh, markRead, markAllRead };
}
