"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Folder, FolderInvite } from "@/lib/types";

type Props = {
  token: string;
};

export function ShareFolderInviteAccept({ token }: Props) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [invite, setInvite] = useState<FolderInvite | null>(null);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.previewShareFolderInvite(token);
        if (!cancelled) {
          setInvite(data.invite);
          setFolder(data.folder);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Invite not available");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    setAccepting(true);
    setError("");
    try {
      await api.acceptShareFolderInvite(token);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite");
      setAccepting(false);
    }
  }

  if (authLoading) {
    return (
      <AuthShell title="Share folder invite" subtitle="Checking invitation…">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </AuthShell>
    );
  }

  if (error && !folder) {
    return (
      <AuthShell title="Share folder invite" subtitle="This link may be invalid or expired.">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Join shared folder" subtitle="Collaborate on photos with people you trust.">
      {folder && invite ? (
        <div className="space-y-4">
          <p className="text-sm">
            You&apos;re invited to collaborate on <strong>{folder.name}</strong> as{" "}
            <strong>{invite.email}</strong>.
          </p>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {user ? (
            <Button className="w-full" disabled={accepting} onClick={() => void accept()}>
              {accepting ? "Joining…" : "Accept invite"}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Button nativeButton={false} render={<Link href={`/login?next=/invite/share-folder/${token}`} />}>
                Log in to accept
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/register?next=/invite/share-folder/${token}`} />}
              >
                Create account
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Loading invite…</p>
      )}
    </AuthShell>
  );
}
