"use client";

import { Download, UserMinus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, apiErrorMessage } from "@/lib/api";
import type { Folder, FolderInvite, FolderMember } from "@/lib/types";

type Props = {
  folder: Folder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void | Promise<void>;
};

export function ShareFolderSettings({ folder, open, onOpenChange, onUpdated }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [members, setMembers] = useState<FolderMember[]>([]);
  const [invites, setInvites] = useState<FolderInvite[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadAccess = useCallback(async () => {
    if (!folder?.id || !enabled) {
      setMembers([]);
      setInvites([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getShareFolderAccess(folder.id);
      setMembers(data.members);
      setInvites(data.invites);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load sharing settings"));
    } finally {
      setLoading(false);
    }
  }, [folder?.id, enabled]);

  useEffect(() => {
    if (!open || !folder) return;
    setEmail("");
    setEnabled(Boolean(folder.isShareFolder));
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.getShareFolderAccess(folder.id);
        if (cancelled) return;
        setEnabled(true);
        setMembers(data.members);
        setInvites(data.invites);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return;
        setEnabled(Boolean(folder.isShareFolder));
        setMembers([]);
        setInvites([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, folder?.id, folder?.isShareFolder, folder?.name]);

  async function toggleSharing(next: boolean) {
    if (!folder) return;
    setBusy(true);
    try {
      if (next) {
        const updated = await api.enableShareFolder(folder.id);
        setEnabled(true);
        toast.success("Share folder enabled");
        await onUpdated();
        setEnabled(Boolean(updated.isShareFolder));
        await loadAccess();
      } else {
        await api.disableShareFolder(folder.id);
        setEnabled(false);
        setMembers([]);
        setInvites([]);
        toast.success("Sharing turned off");
        await onUpdated();
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update sharing"));
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite() {
    if (!enabled || !folder) return;
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.inviteShareFolderMember(folder.id, trimmed);
      setEmail("");
      toast.success("Invite sent — they will see it in notifications if they have an account");
      await loadAccess();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not invite"));
    } finally {
      setBusy(false);
    }
  }

  async function downloadZip() {
    if (!folder) return;
    setBusy(true);
    try {
      await api.downloadShareFolderZip(folder.id);
      toast.success("Download started");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not download folder"));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    if (!folder) return;
    setBusy(true);
    try {
      await api.removeShareFolderMember(folder.id, userId);
      toast.success("Member removed");
      await loadAccess();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not remove member"));
    } finally {
      setBusy(false);
    }
  }

  if (!folder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,640px)] max-w-[480px] gap-0 overflow-hidden border-[var(--border)] bg-[var(--bg-primary)] p-0">
        <DialogHeader className="px-5 pt-5 pb-3 text-center">
          <DialogTitle className="flex items-center justify-center gap-2 text-[20px] font-semibold text-[var(--header-primary)]">
            <Users className="size-5 opacity-80" />
            Share folder
          </DialogTitle>
          <p className="text-[13px] text-[var(--muted-foreground)]">{folder.name}</p>
        </DialogHeader>

        <div className="max-h-[50dvh] space-y-4 overflow-y-auto px-5 pb-4">
          {!enabled ? (
            <p className="text-[13px] text-[var(--muted-foreground)]">
              Invite people by email to upload and browse together. They accept from notifications or
              Shared with me (same email). For view-only access without login, use Public link in the
              folder menu.
            </p>
          ) : null}

          {enabled ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => void downloadZip()}
              >
                <Download className="size-4" />
                Download all (zip, 500 MB max)
              </Button>
              <div className="space-y-2">
                <Label htmlFor="share-invite-email" className="discord-label">
                  Invite by email
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="share-invite-email"
                    type="email"
                    placeholder="friend@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 flex-1 rounded-[3px] border-0 bg-[var(--input)]"
                  />
                  <Button type="button" disabled={busy || !email.trim()} onClick={() => void sendInvite()}>
                    Invite
                  </Button>
                </div>
              </div>

              {loading ? (
                <p className="text-[13px] text-[var(--muted-foreground)]">Loading members…</p>
              ) : (
                <>
                  {members.length > 0 ? (
                    <ul className="space-y-2">
                      <p className="discord-label">Members</p>
                      {members.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-md bg-[var(--bg-secondary)] px-3 py-2 text-[13px]"
                        >
                          <span className="min-w-0 truncate">
                            {m.displayName || m.email}
                            <span className="text-[var(--muted-foreground)]"> · {m.email}</span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Remove member"
                            disabled={busy}
                            onClick={() => void removeMember(m.userId)}
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {invites.length > 0 ? (
                    <ul className="space-y-2">
                      <p className="discord-label">Pending email invites</p>
                      {invites.map((inv) => (
                        <li
                          key={inv.id}
                          className="rounded-md bg-[var(--bg-secondary)] px-3 py-2 text-[13px]"
                        >
                          <span className="min-w-0 truncate">{inv.email}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-[var(--border)] px-5 py-4 sm:flex-col">
          {!enabled ? (
            <Button type="button" className="w-full" disabled={busy} onClick={() => void toggleSharing(true)}>
              Enable sharing
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={busy}
              onClick={() => void toggleSharing(false)}
            >
              Turn off sharing
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
