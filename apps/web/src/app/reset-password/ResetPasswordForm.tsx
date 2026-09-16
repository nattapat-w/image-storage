"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/PasswordInput";
import { useRedirectIfAuthed } from "@/hooks/useRedirectIfAuthed";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ResetPasswordForm() {
  const { loading } = useRedirectIfAuthed();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Missing reset token. Use the link from your email.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
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

  if (done) {
    return (
      <AuthShell title="Password reset" subtitle="Your password has been updated.">
        <div className="space-y-4 text-center">
          <p className="text-[14px] text-[var(--muted-foreground)]">
            You can now sign in with your new password.
          </p>
          <Link
            href="/login"
            className="inline-flex h-[38px] w-full items-center justify-center rounded-[3px] bg-[#5865f2] text-[14px] font-medium text-white hover:bg-[#4752c4]"
          >
            Go to login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Enter a strong password for your account.">
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <Alert variant="destructive" className="border-[#f23f43]/40 bg-[#f23f43]/10">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {!token ? (
          <Alert variant="destructive" className="border-[#f23f43]/40 bg-[#f23f43]/10">
            <AlertDescription>
              Invalid or missing reset link.{" "}
              <Link href="/forgot-password" className="underline">Request a new one</Link>.
            </AlertDescription>
          </Alert>
        ) : null}
        <PasswordInput
          label="New password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="h-10 rounded-[3px] border-0 bg-[var(--input)] text-[16px]"
        />
        <PasswordInput
          label="Confirm password"
          id="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="h-10 rounded-[3px] border-0 bg-[var(--input)] text-[16px]"
        />
        <Button
          type="submit"
          disabled={submitting || !token}
          className="mt-2 h-[38px] w-full rounded-[3px] bg-[#5865f2] text-[14px] font-medium hover:bg-[#4752c4]"
        >
          {submitting ? "Saving…" : "Reset password"}
        </Button>
      </form>
    </AuthShell>
  );
}
