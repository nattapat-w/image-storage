"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** @deprecated Use `/dashboard` — shared folders live in the same drive UI. */
export default function SharedFoldersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}
