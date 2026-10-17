/** Pure helpers behind the profile page. */

/** The page's sections, in page order. */
export const PROFILE_SECTIONS = ['account', 'achievements', 'preferences', 'data'] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

/** Query param an entry point sets to open the profile on a section, e.g. `/profile?section=achievements`. */
export const PROFILE_SECTION_PARAM = 'section';

/** The section the profile opens on: the one the `section` query param names, else the top ("Cuenta"). */
export function initialProfileSection(param: string | null | undefined): ProfileSection {
  const match = PROFILE_SECTIONS.find((section) => section === param);
  return match ?? 'account';
}

/** Error key that means "log in again with Google, then retry" (Google-only account, old token). */
export const REAUTH_REQUIRED_KEY = 'profile.delete.errors.reauth';

interface HttpLikeError {
  status?: number;
  error?: { message?: unknown } | null;
}

function apiCode(err: HttpLikeError): string | null {
  const message = err?.error && typeof err.error === 'object' ? err.error.message : null;
  return typeof message === 'string' ? message : null;
}

/** Maps a DELETE /users/me failure to a translation key. */
export function deleteAccountErrorKey(err: HttpLikeError): string {
  const code = apiCode(err);
  switch (err?.status) {
    case 400:
      if (code === 'INVALID_PASSWORD') return 'profile.delete.errors.password';
      if (code === 'CONFIRMATION_MISMATCH') return 'profile.delete.errors.confirmation';
      return 'profile.delete.errors.confirmation';
    case 403:
      return code === 'REAUTH_REQUIRED' ? REAUTH_REQUIRED_KEY : 'auth.errors.generic';
    case 409:
      return 'profile.delete.errors.syncInProgress';
    case 429:
      return 'auth.errors.tooManyRequests';
    case 0:
      return 'profile.errors.network';
    default:
      return 'auth.errors.generic';
  }
}

/** Maps a GET /users/me/export failure to a translation key. */
export function exportErrorKey(err: HttpLikeError): string {
  switch (err?.status) {
    case 429:
      return 'profile.export.rateLimited';
    case 0:
      return 'profile.errors.network';
    default:
      return 'profile.export.error';
  }
}

/** Same rule as the API (UsernamePolicy.normalize): trimmed, case-insensitive. */
export function confirmsUsername(typed: string, username: string): boolean {
  return typed.trim().toLowerCase() === username.trim().toLowerCase() && typed.trim() !== '';
}

/** "julio de 2026" / "July 2026" from an ISO timestamp; null when missing or invalid. */
export function formatMemberSince(iso: string | null | undefined, lang: string): string | null {
  const time = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(time)) {
    return null;
  }
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' }).format(
    new Date(time),
  );
}

/** Maps a PATCH /users/me avatar failure to a translation key. */
export function avatarErrorKey(err: HttpLikeError): string {
  return err?.status === 0 ? 'profile.errors.network' : 'profile.avatar.error';
}
