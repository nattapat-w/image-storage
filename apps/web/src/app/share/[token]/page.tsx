"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { ShareFolderView } from "@/components/share/ShareFolderView";
import { ShareImageView } from "@/components/share/ShareImageView";
import { SharePageShell } from "@/components/share/SharePageShell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { ShareView } from "@/lib/types";

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .viewShare(token)
      .then(setData)
      .catch(() => setError("This share link is invalid or has expired."));
  }, [token]);

  if (error) {
    return (
      <SharePageShell>
        <div className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--destructive)]/15">
              <AlertCircle className="size-6 text-[var(--destructive)]" aria-hidden />
            </div>
            <h1 className="mt-4 font-heading text-lg font-semibold text-[var(--header-primary)]">
              Link unavailable
            </h1>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{error}</p>
            <Button className="mt-6" nativeButton={false} render={<Link href="/login" />}>
              Sign in
            </Button>
          </div>
        </div>
      </SharePageShell>
    );
  }

  if (!data) {
    return (
      <SharePageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-[var(--muted-foreground)]">
          <Loader2 className="size-8 animate-spin text-[#5865f2]" aria-hidden />
          <p className="text-sm">Loading shared content…</p>
        </div>
      </SharePageShell>
    );
  }

  return (
    <SharePageShell>
      {data.type === "image" ? (
        <ShareImageView img={data.image} token={token} />
      ) : (
        <ShareFolderView folders={data.folders} images={data.images} token={token} />
      )}
    </SharePageShell>
  );
}
