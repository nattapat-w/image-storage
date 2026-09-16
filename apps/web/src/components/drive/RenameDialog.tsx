"use client";

import { useEffect, useRef, useState } from "react";
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

export function RenameDialog({
  open,
  title,
  label,
  initialName,
  extensionSuffix,
  onOpenChange,
  onRename,
}: {
  open: boolean;
  title: string;
  label: string;
  initialName: string;
  extensionSuffix?: string;
  onOpenChange: (open: boolean) => void;
  onRename: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, initialName]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName.trim()) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      await onRename(trimmed);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border-[var(--border)] bg-[var(--bg-primary)] p-0 sm:max-w-[440px]">
        <DialogHeader className="gap-0 px-5 pt-5 pb-4 text-center">
          <DialogTitle className="text-[20px] font-semibold text-[var(--header-primary)]">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 px-5 pb-5">
          <Label htmlFor="rename-name" className="discord-label">
            {label}
          </Label>
          <div className="flex min-w-0 items-stretch overflow-hidden rounded-[4px] bg-[var(--input)]">
            <Input
              ref={inputRef}
              id="rename-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 text-[15px] shadow-none focus-visible:ring-0"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            {extensionSuffix ? (
              <span className="flex shrink-0 items-center border-l border-[var(--border)] px-3 text-[14px] text-[var(--muted-foreground)]">
                {extensionSuffix}
              </span>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4 sm:justify-end">
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
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
