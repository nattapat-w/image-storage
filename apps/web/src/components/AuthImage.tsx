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

  if (fetching || !blobUrl) {
    return (
      <div
        className={cn(
          "flex h-full w-full min-h-0 items-center justify-center bg-[var(--bg-tertiary)]/40 text-[var(--muted-foreground)]",
          className,
        )}
        aria-hidden={onLoadChange ? true : undefined}
      >
        <Loader2 className="size-8 animate-spin text-[#5865f2]" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={blobUrl}
      alt={alt}
      className={className}
      onLoad={() => onLoadChange?.(false)}
      onError={() => onLoadChange?.(false)}
    />
  );
}

export const AuthImage = memo(AuthImageComponent);
