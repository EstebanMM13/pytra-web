/**
 * One-shot destination after an external login (Google), used to resume an action that
 * required a fresh session, e.g. deleting a Google-only account. Only whitelisted paths are
 * honoured, and only for a few minutes. Kept in sessionStorage: it survives the full-page OAuth
 * round trip on web and the Custom Tab flow on Android (the WebView is not reloaded).
 */
const KEY = 'pytra_post_login';

export const RESUME_DELETE_ACCOUNT = '/profile?delete=1';

/** How long a remembered destination stays valid. */
export const POST_LOGIN_REDIRECT_TTL_MS = 5 * 60 * 1000;

const ALLOWED = new Set([RESUME_DELETE_ACCOUNT]);

interface StoredRedirect {
  path: string;
  ts: number;
}

export function rememberPostLoginRedirect(path: string, now: number = Date.now()): void {
  if (!ALLOWED.has(path)) {
    return;
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, ts: now } satisfies StoredRedirect));
  } catch {
    // Storage unavailable: the user simply lands on the dashboard.
  }
}

/** Forgets any pending destination (dialog closed, logout). */
export function clearPostLoginRedirect(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Returns and clears the pending destination (null when none, expired or not allowed). */
export function consumePostLoginRedirect(now: number = Date.now()): string | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
  clearPostLoginRedirect();
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as Partial<StoredRedirect>;
    const fresh =
      typeof value.ts === 'number' && now - value.ts >= 0 && now - value.ts <= POST_LOGIN_REDIRECT_TTL_MS;
    return fresh && typeof value.path === 'string' && ALLOWED.has(value.path) ? value.path : null;
  } catch {
    return null;
  }
}
