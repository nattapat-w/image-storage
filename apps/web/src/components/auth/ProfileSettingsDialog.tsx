"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth, userDisplayName } from "@/components/AuthProvider";
import { PasswordInput } from "@/components/PasswordInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Tab = "profile" | "password" | "account";

const tabs: { id: Tab; label: string }[] = [
  { id: "profile", label: "My Account" },
  { id: "password", label: "Password" },
  { id: "account", label: "Account" },
];

function formatMemberSince(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ProfileSettingsDialog({
  open,
  onOpenChange,
  initialTab = "profile",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: Tab;
}) {
  const { user, updateProfile, changePassword, deleteAccount } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setDisplayName(user?.displayName ?? "");
      setEmail(user?.email ?? "");
      setProfileError("");
      setPasswordError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setDeletePassword("");
    }
  }, [open, initialTab, user]);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileBusy(true);
    try {
      await updateProfile({
        email: email.trim(),
        displayName: displayName.trim(),
      });
      toast.success("Profile updated");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setProfileBusy(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function onDeleteAccount() {
    setDeleteBusy(true);
    try {
      await deleteAccount(deletePassword);
      toast.success("Account deleted");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete account");
    } finally {
      setDeleteBusy(false);
      setDeleteOpen(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex flex-col gap-0 overflow-hidden border-[var(--border)] bg-[var(--bg-primary)] p-0",
            "h-[min(640px,calc(100vh-2rem))] w-[min(800px,calc(100vw-2rem))] max-w-none sm:max-w-none",
          )}
        >
          <DialogHeader className="shrink-0 border-b border-[var(--border)] px-6 py-4">
            <DialogTitle className="text-[20px] font-semibold text-[var(--header-primary)]">
              User Settings
            </DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            <nav className="flex shrink-0 gap-1 border-b border-[var(--border)] p-3 sm:w-52 sm:flex-col sm:border-b-0 sm:border-r">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "rounded-[4px] px-3 py-2.5 text-left text-[14px] transition-colors",
                    tab === t.id
                      ? "bg-[var(--modifier-selected)] text-[var(--header-primary)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--modifier-hover)] hover:text-[var(--header-primary)]",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
              {tab === "profile" ? (
                <form onSubmit={onSaveProfile} className="mx-auto w-full max-w-lg space-y-5">
                  <div>
                    <h3 className="text-[12px] font-bold uppercase tracking-wide text-[var(--header-secondary)]">
                      Profile
                    </h3>
                    <p className="mt-1 text-[14px] text-[var(--muted-foreground)]">
                      Manage how others see you in image-storage.
                    </p>
                  </div>
                  {profileError ? (
                    <Alert variant="destructive" className="border-[#f23f43]/40 bg-[#f23f43]/10">
                      <AlertDescription>{profileError}</AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="profile-display-name" className="discord-label">
                      Display name
                    </Label>
                    <Input
                      id="profile-display-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={userDisplayName(user)}
                      className="h-10 rounded-[3px] border-0 bg-[var(--input)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-email" className="discord-label">
                      Email
                    </Label>
                    <Input
                      id="profile-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="h-10 rounded-[3px] border-0 bg-[var(--input)]"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={profileBusy}
                    className="rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4]"
                  >
                    {profileBusy ? "Saving…" : "Save changes"}
                  </Button>
                </form>
              ) : null}

              {tab === "password" ? (
                <form onSubmit={onChangePassword} className="mx-auto w-full max-w-lg space-y-5">
                  <div>
                    <h3 className="text-[12px] font-bold uppercase tracking-wide text-[var(--header-secondary)]">
                      Change password
                    </h3>
                    <p className="mt-1 text-[14px] text-[var(--muted-foreground)]">
                      Use a strong password you do not use elsewhere.
                    </p>
                  </div>
                  {passwordError ? (
                    <Alert variant="destructive" className="border-[#f23f43]/40 bg-[#f23f43]/10">
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  ) : null}
                  <PasswordInput
                    label="Current password"
                    id="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-10 rounded-[3px] border-0 bg-[var(--input)]"
                  />
                  <PasswordInput
                    label="New password"
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="h-10 rounded-[3px] border-0 bg-[var(--input)]"
                  />
                  <PasswordInput
                    label="Confirm new password"
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="h-10 rounded-[3px] border-0 bg-[var(--input)]"
                  />
                  <Button
                    type="submit"
                    disabled={passwordBusy}
                    className="rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4]"
                  >
                    {passwordBusy ? "Updating…" : "Update password"}
                  </Button>
                </form>
              ) : null}

              {tab === "account" ? (
                <div className="mx-auto w-full max-w-lg space-y-8">
                  <div>
                    <h3 className="text-[12px] font-bold uppercase tracking-wide text-[var(--header-secondary)]">
                      Account info
                    </h3>
                    <dl className="mt-4 space-y-4 text-[14px]">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <dt className="shrink-0 text-[var(--muted-foreground)]">Member since</dt>
                        <dd className="text-[var(--header-primary)]">
                          {formatMemberSince(user?.createdAt ?? "")}
                        </dd>
                      </div>
                      <div className="flex flex-col gap-1">
                        <dt className="text-[var(--muted-foreground)]">User ID</dt>
                        <dd className="break-all rounded-[4px] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-[12px] text-[var(--header-primary)]">
                          {user?.id}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="rounded-[8px] border border-[#f23f43]/30 bg-[#f23f43]/5 p-5">
                    <h4 className="text-[15px] font-semibold text-[#f23f43]">Delete account</h4>
                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted-foreground)]">
                      Permanently delete your account and all folders, images, and shares. This
                      cannot be undone.
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      className="mt-4 rounded-[3px]"
                      onClick={() => setDeleteOpen(true)}
                    >
                      Delete my account
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="w-[min(440px,calc(100vw-2rem))] max-w-none gap-0 border-[var(--border)] bg-[var(--bg-primary)] p-0 sm:max-w-none">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-[20px] font-semibold text-[var(--header-primary)]">
              Delete account?
            </DialogTitle>
            <p className="mt-2 text-[14px] text-[var(--muted-foreground)]">
              All your data will be permanently removed. Enter your password to confirm.
            </p>
          </DialogHeader>
          <form
            className="space-y-4 px-4 pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              onDeleteAccount();
            }}
          >
            <PasswordInput
              label="Password"
              id="delete-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-10 rounded-[3px] border-0 bg-[var(--input)]"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                className="rounded-[3px] bg-[#4e5058] hover:bg-[#6d6f78]"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={deleteBusy || !deletePassword}
                className="rounded-[3px] bg-[#f23f43] hover:bg-[#da373c]"
              >
                {deleteBusy ? "Deleting…" : "Delete forever"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
