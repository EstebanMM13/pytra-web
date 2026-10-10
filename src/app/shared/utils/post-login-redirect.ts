/**
 * One-shot destination after an external login (Google), used to resume an action that
 * required a fresh session, e.g. deleting a Google-only account. Only whitelisted paths are
 * honoured. Kept in sessionStorage: it survives the full-page OAuth round trip on web and the
 * Custom Tab flow on Android (the WebView is not reloaded).
 */
const KEY = 'pytra_post_login';

export const RESUME_DELETE_ACCOUNT = '/profile?delete=1';

const ALLOWED = new Set([RESUME_DELETE_ACCOUNT]);

export function rememberPostLoginRedirect(path: string): void {
  if (!ALLOWED.has(path)) {
    return;
  }
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Storage unavailable: the user simply lands on the dashboard.
  }
}

/** Returns and clears the pending destination (null when none or not allowed). */
export function consumePostLoginRedirect(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && ALLOWED.has(path) ? path : null;
  } catch {
    return null;
  }
}
