"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthImage } from "@/components/AuthImage";
import { api, formatBytes } from "@/lib/api";
import { displayImageName } from "@/lib/image-name";
import type { ShareView } from "@/lib/types";

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .viewShare(token)
      .then(setData)
      .catch(() => setError("Share link invalid or expired"));
  }, [token]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">{error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">Loading…</p>
      </main>
    );
  }

  if (data.type === "image") {
    const img = data.image;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 p-6 dark:bg-zinc-950">
        <AuthImage
          src={api.imageFileUrl(img.id, token)}
          alt={displayImageName(img.name, img.mimeType)}
          className="max-h-[80vh] max-w-full rounded-xl object-contain"
        />
        <p className="font-medium">{displayImageName(img.name, img.mimeType)}</p>
        <p className="text-sm text-zinc-500">{formatBytes(img.size)}</p>
        <Link href="/" className="text-sm text-blue-600 underline">
          Home
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
      <h1 className="mb-4 text-xl font-semibold">Shared folder</h1>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {data.folders.map((f) => (
          <div key={f.id} className="rounded-xl border bg-white p-4 text-center dark:bg-zinc-900">
            <span className="text-3xl">📁</span>
            <p className="mt-1 truncate text-sm">{f.name}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {data.images.map((img) => (
          <div key={img.id} className="rounded-xl border bg-white p-2 dark:bg-zinc-900">
            <AuthImage
              src={api.imageFileUrl(img.id, token)}
              alt={displayImageName(img.name, img.mimeType)}
              className="aspect-square w-full rounded-lg object-cover"
            />
            <p className="mt-1 truncate text-xs">{displayImageName(img.name, img.mimeType)}</p>
          </div>
        ))}
      </div>
      <Link href="/" className="mt-6 inline-block text-sm text-blue-600 underline">
        Home
      </Link>
    </main>
  );
}
