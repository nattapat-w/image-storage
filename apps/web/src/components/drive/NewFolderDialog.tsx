"use client";

import { useEffect, useState } from "react";
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

export function NewFolderDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onCreate(trimmed);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] gap-0 border-[var(--border)] bg-[var(--bg-primary)] p-0">
        <DialogHeader className="px-4 pt-4 pb-2 text-center">
          <DialogTitle className="text-[20px] font-semibold text-[var(--header-primary)]">
            Create folder
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 px-4 pb-4">
          <Label htmlFor="folder-name" className="discord-label">
            Folder name
          </Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Vacation photos"
            className="h-10 rounded-[3px] border-0 bg-[var(--input)] text-[16px]"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2 bg-[var(--bg-secondary)] px-4 py-4 sm:justify-end">
          <Button
            variant="secondary"
            className="min-h-[38px] rounded-[3px] bg-[#4e5058] hover:bg-[#6d6f78]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="min-h-[38px] rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4]"
            disabled={!name.trim() || busy}
            onClick={submit}
          >
            {busy ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
