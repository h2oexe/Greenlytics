import { apiRequest } from "../lib/http";
import { getStoredSession, setStoredSession } from "../lib/session-storage";
import type { AuthResponse } from "../types/api";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export function getCurrentSession() {
  return getStoredSession();
}

export function clearSession() {
  setStoredSession(null);
}

export async function login(input: LoginInput) {
  const session = await apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: input,
    auth: false
  });

  setStoredSession(session);
  return session;
}

export async function register(input: RegisterInput) {
  const session = await apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: input,
    auth: false
  });

  setStoredSession(session);
  return session;
}

export async function restoreSession() {
  const session = getStoredSession();

  if (!session) {
    return null;
  }

  try {
    const refreshed = await apiRequest<AuthResponse>("/api/auth/refresh", {
      method: "POST",
      body: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken
      },
      auth: false
    });

    setStoredSession(refreshed);
    return refreshed;
  } catch {
    setStoredSession(null);
    return null;
  }
}
