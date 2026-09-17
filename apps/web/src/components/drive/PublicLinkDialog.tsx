"use client";

import { Copy, Link2, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, apiErrorMessage } from "@/lib/api";
import type { Folder, Share } from "@/lib/types";

type Props = {
  folder: Folder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ExpiryPreset = "never" | "1d" | "7d" | "30d" | "90d";

function expiryIso(preset: ExpiryPreset): string | null {
  if (preset === "never") return null;
  const days = preset === "1d" ? 1 : preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return "No expiration";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  if (d.getTime() <= Date.now()) return "Expired";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shareFullUrl(share: Share): string {
  return `${window.location.origin}${share.url}`;
}

export function PublicLinkDialog({ folder, open, onOpenChange }: Props) {
  const [links, setLinks] = useState<Share[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState<ExpiryPreset>("7d");

  const load = useCallback(async () => {
    if (!folder?.id) return;
    setLoading(true);
    try {
      const list = await api.listShares("folder", folder.id);
      setLinks(list);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load links"));
    } finally {
      setLoading(false);
    }
  }, [folder?.id]);

  useEffect(() => {
    if (open && folder?.id) void load();
  }, [open, folder?.id, load]);

  async function createLink() {
    if (!folder) return;
    setBusy(true);
    try {
      const expiresAt = expiryIso(preset);
      const share = await api.createShare("folder", folder.id, expiresAt);
      toast.success("Public link created");
      await load();
      await navigator.clipboard.writeText(shareFullUrl(share));
      toast.message("Link copied to clipboard");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create link"));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(share: Share) {
    await navigator.clipboard.writeText(shareFullUrl(share));
    toast.success("Link copied");
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await api.deleteShare(id);
      toast.success("Link removed");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not remove link"));
    } finally {
      setBusy(false);
    }
  }

  if (!folder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,560px)] max-w-[480px] gap-0 overflow-hidden border-[var(--border)] bg-[var(--bg-primary)] p-0">
        <DialogHeader className="px-5 pt-5 pb-3 text-center">
          <DialogTitle className="flex items-center justify-center gap-2 text-[20px] font-semibold text-[var(--header-primary)]">
            <Link2 className="size-5 opacity-80" />
            Public link
          </DialogTitle>
          <p className="text-[13px] text-[var(--muted-foreground)]">{folder.name}</p>
        </DialogHeader>

        <div className="max-h-[50dvh] space-y-4 overflow-y-auto px-5 pb-4">
          <p className="text-[13px] text-[var(--muted-foreground)]">
            Anyone with the link can view this folder and download photos — no sign-in required.
            This is separate from inviting collaborators by email.
          </p>

          <div className="space-y-2">
            <Label className="discord-label">Link expires</Label>
            <Select value={preset} onValueChange={(v) => v && setPreset(v as ExpiryPreset)}>
              <SelectTrigger className="h-10 border-0 bg-[var(--input)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="1d">In 1 day</SelectItem>
                <SelectItem value="7d">In 7 days</SelectItem>
                <SelectItem value="30d">In 30 days</SelectItem>
                <SelectItem value="90d">In 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" className="w-full" disabled={busy} onClick={() => void createLink()}>
              Create link
            </Button>
          </div>

          {loading ? (
            <p className="text-[13px] text-[var(--muted-foreground)]">Loading links…</p>
          ) : links.length > 0 ? (
            <ul className="space-y-2">
              <p className="discord-label">Active links</p>
              {links.map((link) => (
                <li
                  key={link.id}
                  className="flex items-start justify-between gap-2 rounded-md bg-[var(--bg-secondary)] px-3 py-2 text-[13px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[var(--header-primary)]">{shareFullUrl(link)}</p>
                    <p className="text-[var(--muted-foreground)]">{formatExpiry(link.expiresAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Copy link"
                      onClick={() => void copyLink(link)}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Remove link"
                      disabled={busy}
                      onClick={() => void revoke(link.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[var(--muted-foreground)]">No public links yet.</p>
          )}
        </div>

        <DialogFooter className="border-t border-[var(--border)] px-5 py-4">
          <Button type="button" variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
