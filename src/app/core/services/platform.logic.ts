import {
  PLATFORM_FAMILIES,
  PLATFORM_NAME_MAX_LENGTH,
  Platform,
  PlatformFamily,
  PlatformRef,
} from '../models/platform.model';

/** Pure helpers around the platform catalog. */

/** Catalog order: sortOrder, then name, then id (same as the API). */
export function sortPlatforms(platforms: readonly Platform[]): Platform[] {
  return [...platforms].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) ||
      a.id - b.id,
  );
}

export interface PlatformGroup {
  family: PlatformFamily;
  platforms: Platform[];
}

/** Families in a fixed order (PC, PlayStation, Xbox, Nintendo, Mobile, Other); empty ones are left out. */
export function groupPlatformsByFamily(platforms: readonly Platform[]): PlatformGroup[] {
  return PLATFORM_FAMILIES.map((family) => ({
    family,
    platforms: platforms.filter((p) => (p.family ?? 'OTHER') === family),
  })).filter((group) => group.platforms.length > 0);
}

/**
 * Finds a platform from a stored key: a catalog id (`"14"`), an old enum value (`"SWITCH"`, the
 * format of preferences saved before the catalog existed) or a name, case-insensitively.
 */
export function findPlatformByKey(platforms: readonly Platform[], key: string | number | null | undefined): Platform | null {
  if (key === null || key === undefined || key === '') {
    return null;
  }
  const text = String(key).trim();
  if (/^\d+$/.test(text)) {
    return platforms.find((p) => p.id === Number(text)) ?? null;
  }
  const lower = text.toLowerCase();
  return (
    platforms.find((p) => p.legacyCode?.toLowerCase() === lower) ??
    platforms.find((p) => p.name.toLowerCase() === lower) ??
    null
  );
}

/** Same trimming and whitespace collapsing as the API. */
export function normalizePlatformName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function isValidPlatformName(name: string): boolean {
  const normalized = normalizePlatformName(name);
  return normalized.length >= 1 && normalized.length <= PLATFORM_NAME_MAX_LENGTH;
}

/**
 * Seeded catalog names are Spanish; these have a translation (`platform.*` keys). Every other name
 * (PS5, Switch, user-created ones…) is shown as-is.
 */
const TRANSLATED_NAMES: Record<string, string> = {
  'móvil': 'platform.MOBILE',
  'retro / emulador': 'platform.RETRO',
};

/** Translation key for a catalog name, or null when the name is shown verbatim. */
export function platformNameKey(name: string | null | undefined): string | null {
  return name ? (TRANSLATED_NAMES[name.toLowerCase()] ?? null) : null;
}

/** Distinct platforms by id, keeping the first occurrence. */
export function distinctPlatformRefs(refs: readonly PlatformRef[]): PlatformRef[] {
  const seen = new Set<number>();
  return refs.filter((ref) => (seen.has(ref.id) ? false : (seen.add(ref.id), true)));
}
