"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { useRedirectIfAuthed } from "@/hooks/useRedirectIfAuthed";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const { loading } = useRedirectIfAuthed();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setResetUrl("");
    setSubmitting(true);
    try {
      const res = await api.forgotPassword(email);
      setMessage(res.message);
      if (res.resetUrl) setResetUrl(res.resetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[var(--muted-foreground)]">
        Loading…
      </main>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="We'll send you instructions to reset it."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <Alert variant="destructive" className="border-[#f23f43]/40 bg-[#f23f43]/10">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {message ? (
          <Alert className="border-[#5865f2]/40 bg-[#5865f2]/10">
            <AlertDescription className="text-[var(--foreground)]">
              {message}
              {resetUrl ? (
                <span className="mt-2 block">
                  <Link
                    href={
                      resetUrl.startsWith("/")
                        ? resetUrl
                        : `/reset-password?token=${encodeURIComponent(new URL(resetUrl).searchParams.get("token") ?? "")}`
                    }
                    className="text-[var(--text-link)] hover:underline"
                  >
                    Open reset link
                  </Link>
                  <span className="mt-1 block text-[12px] text-[var(--muted-foreground)]">
                    Dev mode: email is not configured, so the reset link is shown here.
                  </span>
                </span>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email" className="discord-label">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="h-10 rounded-[3px] border-0 bg-[var(--input)] text-[16px]"
          />
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="mt-2 h-[38px] w-full rounded-[3px] bg-[#5865f2] text-[14px] font-medium hover:bg-[#4752c4]"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
        <p className="text-center text-[14px] text-[var(--muted-foreground)]">
          <Link href="/login" className="text-[var(--text-link)] hover:underline">
            Back to login
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
