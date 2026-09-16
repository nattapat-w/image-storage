const TOKEN_KEY = "image_storage_token";
const REMEMBER_KEY = "image_storage_remember";
const LAST_EMAIL_KEY = "image_storage_last_email";

function tokenStorage(): Storage {
  if (typeof window === "undefined") return localStorage;
  return localStorage.getItem(REMEMBER_KEY) === "0"
    ? sessionStorage
    : localStorage;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return tokenStorage().getItem(TOKEN_KEY);
}

export function setToken(token: string | null, remember = true) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (token) tokenStorage().setItem(TOKEN_KEY, token);
}

export function getRememberMe(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(REMEMBER_KEY) !== "0";
}

export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  if (!remember) {
    localStorage.removeItem(LAST_EMAIL_KEY);
  }
}

export function getLastEmail(): string {
  if (typeof window === "undefined") return "";
  if (!getRememberMe()) return "";
  return localStorage.getItem(LAST_EMAIL_KEY) ?? "";
}

export function setLastEmail(email: string) {
  if (typeof window === "undefined") return;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    localStorage.removeItem(LAST_EMAIL_KEY);
    return;
  }
  localStorage.setItem(LAST_EMAIL_KEY, trimmed);
}

export function clearRememberedLogin() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LAST_EMAIL_KEY);
}
