import type { AuthResponse } from "../types/api";

const STORAGE_KEY = "greenlytics.session";

export function getStoredSession(): AuthResponse | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthResponse;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setStoredSession(session: AuthResponse | null) {
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}
