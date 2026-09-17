"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getToken } from "@/lib/api";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasSession = Boolean(user && getToken());

  useEffect(() => {
    if (!loading && !hasSession) {
      const next = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`;
      const q =
        next.startsWith("/") && !next.startsWith("/login")
          ? `?next=${encodeURIComponent(next)}`
          : "";
      router.replace(`/login${q}`);
    }
  }, [loading, hasSession, router, pathname, searchParams]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }
  if (!hasSession) return null;
  return <>{children}</>;
}
