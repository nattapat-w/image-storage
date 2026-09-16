"use client";

import Link from "next/link";
import { Images } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";

export function SharePageShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg-primary)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg-floating)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#5865f2]/20">
              <Images className="size-4 text-[#5865f2]" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate font-heading text-sm font-semibold text-[var(--header-primary)]">
                Shared with you
              </p>
              <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                image-storage
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            nativeButton={false}
            render={<Link href={user ? "/dashboard" : "/login"} />}
          >
            <span className="sm:hidden">{user ? "Drive" : "Sign in"}</span>
            <span className="hidden sm:inline">{user ? "Open drive" : "Sign in"}</span>
          </Button>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
