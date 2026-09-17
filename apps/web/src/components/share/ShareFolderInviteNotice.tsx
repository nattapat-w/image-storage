"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { IncomingShareFolderInvite } from "@/lib/types";

type Props = {
  invites: IncomingShareFolderInvite[];
  acceptingInviteId: string | null;
  onAccept: (row: IncomingShareFolderInvite) => void;
  /** One-line strip with link to Shared with me (My Drive, shared browse). */
  compact?: boolean;
};

export function ShareFolderInviteNotice({
  invites,
  acceptingInviteId,
  onAccept,
  compact = false,
}: Props) {
  if (invites.length === 0) return null;

  if (compact) {
    const n = invites.length;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#5865f2]/30 bg-[#5865f2]/10 px-3 py-2 sm:px-4">
        <p className="text-[13px] font-medium text-[var(--header-primary)]">
          {n} shared folder invite{n === 1 ? "" : "s"} waiting for you
        </p>
        <Button
          size="sm"
          className="h-8 rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4]"
          nativeButton={false}
          render={<Link href="/dashboard/shared" />}
        >
          Review invites
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
      <p className="discord-label">Invitations for you</p>
      {invites.map((row) => (
        <div
          key={row.invite.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] bg-[var(--bg-tertiary)] px-3 py-2"
        >
          <div className="min-w-0 text-sm text-[var(--header-primary)]">
            <span className="font-medium">{row.folder.name}</span>
            <span className="text-[var(--muted-foreground)]">
              {" "}
              · from {row.ownerEmail ?? "someone"} · {row.invite.email}
            </span>
          </div>
          <Button
            size="sm"
            className="h-8 rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4]"
            disabled={acceptingInviteId === row.invite.id}
            onClick={() => onAccept(row)}
          >
            {acceptingInviteId === row.invite.id ? "Joining…" : "Accept"}
          </Button>
        </div>
      ))}
    </div>
  );
}
