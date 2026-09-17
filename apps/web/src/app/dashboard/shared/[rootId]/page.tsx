"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { stashDriveOpenFolder } from "@/lib/drive-folder-nav";

function RedirectInner() {
  const router = useRouter();
  const params = useParams<{ rootId: string }>();
  const searchParams = useSearchParams();
  const parentId = searchParams.get("parentId");

  useEffect(() => {
    const folder = parentId && parentId !== params.rootId ? parentId : params.rootId;
    stashDriveOpenFolder(folder);
    router.replace("/dashboard");
  }, [router, params.rootId, parentId]);

  return null;
}

/** @deprecated Use `/dashboard` — folder opens via in-app state. */
export default function SharedFolderBrowseRedirectPage() {
  return (
    <Suspense fallback={null}>
      <RedirectInner />
    </Suspense>
  );
}
