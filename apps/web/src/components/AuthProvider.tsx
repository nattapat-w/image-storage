"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  api,
  AUTH_SESSION_EXPIRED,
  clearRememberedLogin,
  getToken,
  setLastEmail,
  setToken,
} from "@/lib/api";
import type { User } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    remember?: boolean,
    redirectTo?: string,
  ) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { email: string; displayName: string }) => Promise<void>;
  updateAutoTagEnabled: (enabled: boolean) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    const me = await api.me();
    setUser(me);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      const next =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "";
      const q =
        next && next.startsWith("/") && !next.startsWith("/login")
          ? `?next=${encodeURIComponent(next)}`
          : "";
      router.replace(`/login${q}`);
    };
    window.addEventListener(AUTH_SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED, onExpired);
  }, [router]);

  const login = useCallback(
    async (email: string, password: string, remember = true, redirectTo = "/dashboard") => {
      const res = await api.login(email, password, remember);
      if (remember) {
        setLastEmail(email);
      } else {
        clearRememberedLogin();
      }
      setUser(res.user);
      const safe =
        redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/dashboard";
      router.push(safe);
    },
    [router],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await api.register(email, password);
      setUser(res.user);
      router.push("/dashboard");
    },
    [router],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const updateProfile = useCallback(async (data: { email: string; displayName: string }) => {
    const updated = await api.updateProfile(data);
    setUser(updated);
  }, []);

  const updateAutoTagEnabled = useCallback(async (enabled: boolean) => {
    const updated = await api.updateAutoTagEnabled(enabled);
    setUser(updated);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.changePassword(currentPassword, newPassword);
  }, []);

  const deleteAccount = useCallback(
    async (password: string) => {
      await api.deleteAccount(password);
      setToken(null);
      setUser(null);
      router.push("/login");
    },
    [router],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
      updateAutoTagEnabled,
      changePassword,
      deleteAccount,
    }),
    [
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
      updateAutoTagEnabled,
      changePassword,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export function userDisplayName(user: User | null | undefined): string {
  if (!user) return "User";
  if (user.displayName?.trim()) return user.displayName.trim();
  return user.email.split("@")[0] ?? "User";
}

export function userInitials(user: User | null | undefined): string {
  const name = userDisplayName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
