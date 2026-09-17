"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { useNotifications } from "@/hooks/useNotifications";
import { stashDriveOpenFolder } from "@/lib/drive-folder-nav";
import { notificationAppPath } from "@/lib/notification-path";
import { cn } from "@/lib/utils";

type NotificationState = ReturnType<typeof useNotifications>;

type Props = NotificationState & {
  onNavigate?: () => void;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationBell({
  items,
  unreadCount,
  loading,
  refresh,
  markRead,
  markAllRead,
  onNavigate,
}: Props) {
  const router = useRouter();

  async function openNotification(id: string, href: string, read: boolean) {
    if (!read) {
      try {
        await markRead(id);
      } catch {
        /* still navigate */
      }
    }
    onNavigate?.();
    const path = notificationAppPath(href);
    try {
      const u = new URL(path, window.location.origin);
      if (u.pathname === "/dashboard") {
        const folder = u.searchParams.get("folder");
        if (folder) {
          stashDriveOpenFolder(folder);
          router.push("/dashboard");
          return;
        }
      }
    } catch {
      /* fall through */
    }
    router.push(path);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={() => void refresh()}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="relative shrink-0 rounded-[4px]"
            aria-label={
              unreadCount > 0
                ? `${unreadCount} unread notifications`
                : "Notifications"
            }
          >
            <Bell className="size-5 text-[var(--header-primary)]" />
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-[#f23f43] px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="w-[min(360px,calc(100vw-1rem))] border-[var(--border)] bg-[var(--bg-floating)] p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
          <p className="text-[14px] font-semibold text-[var(--header-primary)]">Notifications</p>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[12px]"
              onClick={() => void markAllRead().catch(() => {})}
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>
        <ScrollArea className="max-h-[min(420px,60vh)]">
          {loading && items.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-[var(--muted-foreground)]">
              No notifications yet.
            </p>
          ) : (
            <ul className="py-1">
              {items.map((n) => (
                <li key={n.id}>
                  <DropdownMenuItem
                    className={cn(
                      "flex cursor-pointer flex-col items-start gap-0.5 rounded-none px-3 py-2.5",
                      !n.read && "bg-[#5865f2]/10",
                    )}
                    onClick={() => void openNotification(n.id, n.href, n.read)}
                  >
                    <span className="text-[13px] font-medium text-[var(--header-primary)]">
                      {n.title}
                    </span>
                    <span className="text-[12px] text-[var(--muted-foreground)]">{n.body}</span>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      {formatWhen(n.createdAt)}
                    </span>
                  </DropdownMenuItem>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <DropdownMenuSeparator className="m-0" />
        <div className="px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full text-[12px]"
            nativeButton={false}
            render={
              <a href="/dashboard" onClick={onNavigate}>
                Shared with me
              </a>
            }
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
