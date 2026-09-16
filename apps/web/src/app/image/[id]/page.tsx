"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthImage } from "@/components/AuthImage";
import { api, formatBytes } from "@/lib/api";
import { TruncatedFileName } from "@/components/drive/TruncatedFileName";
import { displayImageName } from "@/lib/image-name";
import type { ImageItem } from "@/lib/types";

export default function ImageViewPage() {
  const { id } = useParams<{ id: string }>();
  const [image, setImage] = useState<ImageItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getImage(id)
      .then(setImage)
      .catch(() => setError("Could not load image"));
  }, [id]);

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-zinc-950 px-4 text-zinc-300">
        <p>{error}</p>
        <Link href="/" className="text-sm text-blue-400 underline">
          Back to drive
        </Link>
      </main>
    );
  }

  if (!image) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-950 text-zinc-400">
        Loading…
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-zinc-950">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-3 py-3 text-zinc-300 sm:gap-4 sm:px-4">
        <div className="min-w-0">
          <TruncatedFileName
            as="p"
            name={image.name}
            mimeType={image.mimeType}
            className="font-medium"
          />
          <p className="text-xs text-zinc-500">
            {formatBytes(image.size)} · {image.visibility}
          </p>
        </div>
        <Link href="/" className="shrink-0 text-sm text-blue-400 underline">
          Drive
        </Link>
      </header>
      <div className="relative min-h-0 flex-1 p-4">
        {image.visibility === "public" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={api.publicImageUrl(image.id)}
            alt={displayImageName(image.name, image.mimeType)}
            className="absolute inset-4 size-[calc(100%-2rem)] object-contain"
          />
        ) : (
          <AuthImage
            src={api.imageFileUrl(image.id)}
            alt={displayImageName(image.name, image.mimeType)}
            className="absolute inset-4 object-contain"
          />
        )}
      </div>
    </main>
  );
}
