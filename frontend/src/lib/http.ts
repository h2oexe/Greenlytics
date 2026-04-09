import { API_BASE_URL } from "./config";
import { getStoredSession, setStoredSession } from "./session-storage";
import type { ApiErrorPayload, AuthResponse } from "../types/api";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

let refreshPromise: Promise<AuthResponse | null> | null = null;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function buildHeaders(options: RequestOptions, token?: string) {
  const headers = new Headers(options.headers);

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

async function parseError(response: Response) {
  let payload: ApiErrorPayload | null = null;

  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    payload = null;
  }

  const message =
    payload?.errors?.join(", ") ||
    payload?.error ||
    payload?.message ||
    `Istek basarisiz oldu (${response.status})`;

  return new ApiError(message, response.status);
}

async function refreshSession(): Promise<AuthResponse | null> {
  const session = getStoredSession();

  if (!session) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken
    })
  });

  if (!response.ok) {
    setStoredSession(null);
    return null;
  }

  const refreshed = (await response.json()) as AuthResponse;
  setStoredSession(refreshed);
  return refreshed;
}

async function ensureFreshSession() {
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = getStoredSession();
  const token = options.auth === false ? undefined : session?.accessToken;
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: buildHeaders(options, token),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
  } catch {
    throw new ApiError(
      `API'ye baglanilamiyor. Backend'in ${API_BASE_URL} adresinde calistigindan emin ol.`,
      0
    );
  }

  if (response.status === 401 && options.retryOnUnauthorized !== false && options.auth !== false) {
    const refreshed = await ensureFreshSession();

    if (refreshed) {
      return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
