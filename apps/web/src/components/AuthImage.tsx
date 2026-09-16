"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchImageBlobUrl, getCachedBlobUrl } from "@/lib/image-blob-cache";
import { cn } from "@/lib/utils";

function markLoaded(img: HTMLImageElement | null, onLoadChange?: (loading: boolean) => void) {
  if (img?.complete && img.naturalWidth > 0) {
    onLoadChange?.(false);
  }
}

function parseImageClassName(className?: string) {
  const layout: string[] = [];
  const imgExtra: string[] = [];

  for (const token of (className ?? "").split(/\s+/).filter(Boolean)) {
    if (
      token.startsWith("object-") ||
      token.startsWith("transition-") ||
      token.startsWith("group-hover:") ||
      token.startsWith("hover:")
    ) {
      imgExtra.push(token);
    } else {
      layout.push(token);
    }
  }

  return {
    layout: layout.join(" "),
    imgExtra: imgExtra.join(" "),
  };
}

function AuthImageComponent({
  src,
  alt,
  className,
  onLoadChange,
}: {
  src: string;
  alt: string;
  className?: string;
  onLoadChange?: (loading: boolean) => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(() => getCachedBlobUrl(src) ?? null);
  const [fetching, setFetching] = useState(() => !getCachedBlobUrl(src));
  const imgRef = useRef<HTMLImageElement>(null);
  const { layout, imgExtra } = parseImageClassName(className);
  const isLoading = fetching || !blobUrl;

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedBlobUrl(src);
    if (cached) {
      setBlobUrl(cached);
      setFetching(false);
      return;
    }

    setFetching(true);
    onLoadChange?.(true);
    setBlobUrl(null);

    fetchImageBlobUrl(src)
      .then((url) => {
        if (cancelled) return;
        setBlobUrl(url);
        setFetching(false);
      })
      .catch(() => {
        if (cancelled) return;
        setBlobUrl(null);
        setFetching(false);
        onLoadChange?.(false);
      });

    return () => {
      cancelled = true;
    };
  }, [src, onLoadChange]);

  useLayoutEffect(() => {
    markLoaded(imgRef.current, onLoadChange);
  }, [blobUrl, onLoadChange]);

  return (
    <div className={cn("relative overflow-hidden", layout)}>
      {isLoading ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-[var(--bg-tertiary)]/40 text-[var(--muted-foreground)]"
          aria-hidden={onLoadChange ? true : undefined}
        >
          <Loader2 className="size-8 shrink-0 animate-spin text-[#5865f2]" />
        </div>
      ) : null}
      {blobUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={blobUrl}
          alt={alt}
          className={cn("absolute inset-0 size-full", imgExtra || "object-cover")}
          onLoad={() => onLoadChange?.(false)}
          onError={() => onLoadChange?.(false)}
        />
      ) : null}
    </div>
  );
}

export const AuthImage = memo(AuthImageComponent);
