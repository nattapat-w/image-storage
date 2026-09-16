"use client";

import { ChevronRight } from "lucide-react";
import type { Breadcrumb } from "@/lib/types";
import { cn } from "@/lib/utils";

type DriveBreadcrumbsProps = {
  crumbs: Breadcrumb[];
  onNavigate: (folderId: string | undefined) => void;
  className?: string;
};

export function DriveBreadcrumbs({ crumbs, onNavigate, className }: DriveBreadcrumbsProps) {
  return (
    <nav
      className={cn("flex min-w-0 flex-1 items-center gap-0.5 text-[20px] leading-tight text-[var(--header-primary)]", className)}
      aria-label="Folder path"
    >
      <button
        type="button"
        className="max-w-[40vw] truncate rounded-md px-1.5 py-0.5 font-normal hover:bg-[var(--modifier-hover)]"
        onClick={() => onNavigate(undefined)}
      >
        My Drive
      </button>
      {crumbs.map((c) => (
        <span key={c.id} className="flex min-w-0 items-center gap-0.5">
          <ChevronRight className="size-5 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
          <button
            type="button"
            className="max-w-[min(28vw,240px)] truncate rounded-md px-1.5 py-0.5 font-normal hover:bg-[var(--modifier-hover)]"
            onClick={() => onNavigate(c.id)}
            title={c.name}
          >
            {c.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
