"use client";

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DriveShareFolderBadge() {
  return (
    <Badge
      variant="secondary"
      className="gap-0.5 border-[#5865f2]/40 bg-[#5865f2]/20 text-[10px] font-medium text-[#a5b3f0]"
    >
      <Users className="size-3" />
      Shared
    </Badge>
  );
}
