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
      className={cn("flex min-w-0 flex-1 items-center gap-0.5 text-base leading-tight text-[var(--header-primary)] sm:text-[20px]", className)}
      aria-label="Folder path"
    >
      <button
        type="button"
        className="max-w-[36vw] truncate rounded-md px-1 py-0.5 font-normal hover:bg-[var(--modifier-hover)] sm:max-w-[40vw] sm:px-1.5"
        onClick={() => onNavigate(undefined)}
      >
        My Drive
      </button>
      {crumbs.map((c) => (
        <span key={c.id} className="flex min-w-0 items-center gap-0.5">
          <ChevronRight className="size-4 shrink-0 text-[var(--muted-foreground)] sm:size-5" aria-hidden />
          <button
            type="button"
            className="max-w-[min(24vw,240px)] truncate rounded-md px-1 py-0.5 font-normal hover:bg-[var(--modifier-hover)] sm:max-w-[min(28vw,240px)] sm:px-1.5"
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
