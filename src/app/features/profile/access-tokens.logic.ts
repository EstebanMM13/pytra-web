/** Pure helpers behind the access tokens block of the profile. */

/** Same cap as the API (PersonalAccessTokenService.MAX_TOKENS_PER_USER). */
export const MAX_ACCESS_TOKENS = 5;
/** Same cap as the API (CreateAccessTokenRequestDto). */
export const ACCESS_TOKEN_NAME_MAX = 50;
export const DEFAULT_ACCESS_TOKEN_NAME = 'Obsidian';

interface HttpLikeError {
  status?: number;
  error?: { message?: unknown } | null;
}

/** Maps a token create/list/revoke failure to a translation key. */
export function accessTokenErrorKey(err: HttpLikeError): string {
  switch (err?.status) {
    case 409:
      return 'profile.tokens.errors.limit';
    case 400:
      return 'profile.tokens.errors.name';
    case 0:
      return 'profile.errors.network';
    default:
      return 'profile.tokens.errors.generic';
  }
}

/** "24 oct 2026" / "Oct 24, 2026" from an ISO date-time; null when missing or invalid. */
export function formatTokenDate(iso: string | null | undefined, lang: string): string | null {
  const time = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(time)) {
    return null;
  }
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(time));
}

/** Trimmed name, or null when it is empty or longer than the API accepts. */
export function validTokenName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed && trimmed.length <= ACCESS_TOKEN_NAME_MAX ? trimmed : null;
}
