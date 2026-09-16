"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] gap-0 overflow-hidden border-[var(--border)] bg-[var(--bg-primary)] p-0">
        <DialogHeader className="px-5 pt-5 pb-4 text-center">
          <DialogTitle className="text-[20px] font-semibold text-[var(--header-primary)]">
            {title}
          </DialogTitle>
          <p className="mt-2 text-[16px] text-[var(--foreground)]">{message}</p>
        </DialogHeader>
        <DialogFooter className="gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4 sm:justify-end">
          <Button
            variant="secondary"
            className="min-h-[38px] rounded-[3px] bg-[#4e5058] hover:bg-[#6d6f78]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className={cnBtn(destructive)}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cnBtn(destructive?: boolean) {
  return destructive
    ? "min-h-[38px] rounded-[3px] bg-[#f23f43] hover:bg-[#da373c]"
    : "min-h-[38px] rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4]";
}
