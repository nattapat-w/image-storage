"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function normalizeTagNames(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const name = raw.trim().toLowerCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function tagListsEqual(a: string[], b: string[]): boolean {
  const na = normalizeTagNames(a);
  const nb = normalizeTagNames(b);
  return na.length === nb.length && na.every((t, i) => t === nb[i]);
}

type TagChipInputProps = {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  onCommit?: () => void;
  className?: string;
};

export function TagChipInput({ id, value, onChange, onCommit, className }: TagChipInputProps) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (value.some((t) => t.toLowerCase() === key)) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-1.5 rounded-[3px] bg-[var(--input)] px-2 py-1.5",
        className,
      )}
    >
      {value.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="h-7 gap-1 rounded-[3px] border border-[var(--border)] bg-[var(--bg-secondary)] pr-1 pl-2 text-[13px] font-normal text-[var(--header-primary)]"
        >
          {tag}
          <button
            type="button"
            className="rounded-[2px] p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--modifier-hover)] hover:text-[var(--header-primary)]"
            aria-label={`Remove tag ${tag}`}
            onClick={() => removeTag(tag)}
          >
            <X className="size-3.5" />
          </button>
        </Badge>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (draft.trim()) addDraft();
            else onCommit?.();
          } else if (e.key === "Backspace" && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (draft.trim()) addDraft();
        }}
        placeholder={value.length === 0 ? "Add tag…" : ""}
        className="min-w-[5rem] flex-1 border-0 bg-transparent py-1 text-[14px] text-[var(--header-primary)] outline-none placeholder:text-[var(--muted-foreground)]"
      />
    </div>
  );
}
