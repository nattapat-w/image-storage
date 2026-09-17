"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/PasswordInput";
import { useRedirectIfAuthed } from "@/hooks/useRedirectIfAuthed";
import { getLastEmail, getRememberMe, setRememberMe } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const { loading } = useRedirectIfAuthed(nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const remembered = getRememberMe();
    setRemember(remembered);
    if (remembered) {
      const lastEmail = getLastEmail();
      if (lastEmail) setEmail(lastEmail);
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const next =
        nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
          ? nextPath
          : undefined;
      await login(email, password, remember, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
    <AuthShell title="Welcome back!" subtitle="We're so excited to see you again!">
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
            autoComplete="username email"
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
          autoComplete="current-password"
          className="h-10 rounded-[3px] border-0 bg-[var(--input)] text-[16px]"
        />
        <p className="text-right text-[12px]">
          <Link href="/forgot-password" className="text-[var(--text-link)] hover:underline">
            Forgot password?
          </Link>
        </p>
        <div className="flex items-center gap-2">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(v) => {
              const checked = v === true;
              setRemember(checked);
              setRememberMe(checked);
            }}
          />
          <Label htmlFor="remember" className="cursor-pointer text-[14px] font-normal text-[var(--muted-foreground)]">
            Remember me on this device
          </Label>
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="mt-2 h-[38px] w-full rounded-[3px] bg-[#5865f2] text-[14px] font-medium hover:bg-[#4752c4]"
        >
          {submitting ? "Signing in…" : "Log In"}
        </Button>
        <p className="text-center text-[14px] text-[var(--muted-foreground)]">
          Need an account?{" "}
          <Link href="/register" className="text-[var(--text-link)] hover:underline">
            Register
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
