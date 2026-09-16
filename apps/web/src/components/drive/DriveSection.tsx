"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type DriveSectionProps = {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export function DriveSection({
  title,
  count,
  expanded,
  onToggle,
  children,
}: DriveSectionProps) {
  if (count === 0) return null;

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-[4px] px-1 py-1.5 text-left transition-colors hover:bg-[var(--modifier-hover)]"
        aria-expanded={expanded}
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--muted-foreground)] transition-transform",
            !expanded && "-rotate-90",
          )}
        />
        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--header-secondary)]">
          {title}
        </span>
        <span className="text-[11px] font-normal normal-case text-[var(--muted-foreground)]">
          ({count})
        </span>
      </button>
      {expanded ? children : null}
    </section>
  );
}
