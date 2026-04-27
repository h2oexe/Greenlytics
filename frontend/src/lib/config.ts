function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function getBrowserApiBaseUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:5000";
  }

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:5000`;
}

function resolveApiBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!raw) {
    return getBrowserApiBaseUrl();
  }

  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    return trimTrailingSlash(raw);
  }

  if (typeof window !== "undefined" && !isLoopbackHost(window.location.hostname) && isLoopbackHost(parsed.hostname)) {
    parsed.hostname = window.location.hostname;
  }

  return trimTrailingSlash(parsed.toString());
}

export const API_BASE_URL = resolveApiBaseUrl();
