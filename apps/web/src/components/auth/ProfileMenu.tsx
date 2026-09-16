"use client";

import { useState } from "react";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { useAuth, userDisplayName, userInitials } from "@/components/AuthProvider";
import { ProfileSettingsDialog } from "@/components/auth/ProfileSettingsDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"profile" | "password" | "account">("profile");

  function openSettings(tab: "profile" | "password" | "account") {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className={cn(
                "h-9 max-w-[220px] gap-2 rounded-[4px] px-2 hover:bg-[var(--modifier-hover)]",
              )}
            >
              <div className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-semibold text-white">
                {userInitials(user)}
                <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-2 border-[var(--bg-primary)] bg-[var(--status-online)]" />
              </div>
              <div className="hidden min-w-0 text-left sm:block">
                <p className="truncate text-[13px] font-medium leading-tight text-[var(--header-primary)]">
                  {userDisplayName(user)}
                </p>
                <p className="truncate text-[11px] leading-tight text-[var(--muted-foreground)]">
                  {user?.email}
                </p>
              </div>
              <ChevronDown className="size-4 shrink-0 text-[var(--muted-foreground)]" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56 border-[var(--border)] bg-[var(--bg-floating)]">
          <div className="px-2 py-2">
            <p className="truncate text-[14px] font-semibold text-[var(--header-primary)]">
              {userDisplayName(user)}
            </p>
            <p className="truncate text-[12px] text-[var(--muted-foreground)]">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openSettings("profile")}>
            <UserRound className="size-4" />
            Manage profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openSettings("password")}>
            <Settings className="size-4" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={logout}>
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab={settingsTab}
      />
    </>
  );
}
