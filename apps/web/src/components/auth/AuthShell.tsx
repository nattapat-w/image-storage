import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--bg-tertiary)] p-4 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, #5865f2 0%, transparent 55%)",
        }}
      />
      <div className="relative w-full max-w-[480px] overflow-hidden rounded-[4px] bg-[var(--bg-primary)] shadow-[0_8px_16px_rgba(0,0,0,0.24)]">
        <div className="px-4 pt-8 pb-2 text-center sm:px-8">
          <div className="discord-rail-icon discord-rail-icon-active mx-auto mb-4">
            <ImageIcon className="size-6" />
          </div>
          <h1
            className="text-[24px] font-semibold text-[var(--header-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h1>
          <p className="mt-1 text-[16px] text-[var(--muted-foreground)]">{subtitle}</p>
        </div>
        <div className="px-4 pb-8 sm:px-8">{children}</div>
      </div>
    </main>
  );
}
