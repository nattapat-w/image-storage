"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/PasswordInput";
import { useRedirectIfAuthed } from "@/hooks/useRedirectIfAuthed";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const { register } = useAuth();
  const { loading } = useRedirectIfAuthed();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
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
      await register(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
    <AuthShell title="Create an account" subtitle="Store and share your images in one place">
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <Alert variant="destructive" className="border-[#f23f43]/40 bg-[#f23f43]/10">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email" className="discord-label">
            Email
          </Label>
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
        <PasswordInput
          label="Password"
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
          disabled={submitting}
          className="mt-2 h-[38px] w-full rounded-[3px] bg-[#5865f2] text-[14px] font-medium hover:bg-[#4752c4]"
        >
          {submitting ? "Creating…" : "Continue"}
        </Button>
        <p className="text-center text-[14px] text-[var(--muted-foreground)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--text-link)] hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
