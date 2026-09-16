"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DriveVisibilityBadge({ visibility }: { visibility: string }) {
  const pub = visibility === "public";
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[10px] font-medium uppercase",
        pub
          ? "border-[#5865f2]/50 bg-[#5865f2]/30 text-[#a5b3f0]"
          : "bg-[var(--bg-tertiary)] text-[var(--muted-foreground)]",
      )}
    >
      {pub ? "Public" : "Private"}
    </Badge>
  );
}
