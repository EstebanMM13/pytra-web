import { HttpErrorResponse } from '@angular/common/http';
import { Genre } from '../../../core/models/genre.model';

/** Shortest query the API accepts for a Steam store search. */
export const STEAM_SEARCH_MIN_LENGTH = 2;

/**
 * Comparison key for genre names: trimmed, single-spaced, upper case and without accents, so
 * Steam's "Acción" matches a user genre stored as "ACCION" or "ACCIÓN" (the API upper-cases names).
 */
export function genreKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('es');
}

/**
 * Well-known equivalents of Steam's Spanish genre names (keys from {@link genreKey}), so a user
 * who named genres in English or with the usual acronym still gets a match.
 */
const GENRE_ALIASES: Record<string, readonly string[]> = {
  ACCION: ['ACTION'],
  AVENTURA: ['ADVENTURE'],
  ROL: ['RPG', 'ROLE-PLAYING', 'ROLE PLAYING'],
  ESTRATEGIA: ['STRATEGY'],
  SIMULADORES: ['SIMULACION', 'SIMULADOR', 'SIMULATION'],
  DEPORTES: ['SPORTS', 'DEPORTE'],
  CARRERAS: ['RACING', 'CONDUCCION'],
  'MULTIJUGADOR MASIVO': ['MMO', 'MASSIVELY MULTIPLAYER'],
};

export interface GenreMatch {
  /** User genres that correspond to some Steam genre (each at most once, in Steam's order). */
  matched: Genre[];
  /** Steam genre names with no user genre, offered as one-click suggestions. */
  unmatched: string[];
}

/** Maps Steam genre names onto the user's own genres, case-, accent- and alias-insensitively. */
export function matchGenres(steamGenres: readonly string[], userGenres: readonly Genre[]): GenreMatch {
  const byKey = new Map<string, Genre>();
  for (const genre of userGenres) {
    const key = genreKey(genre.name);
    if (!byKey.has(key)) {
      byKey.set(key, genre);
    }
  }

  const matched: Genre[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  for (const steamName of steamGenres) {
    const key = genreKey(steamName);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const genre = [key, ...(GENRE_ALIASES[key] ?? [])].map((k) => byKey.get(k)).find((g) => g !== undefined);
    if (!genre) {
      unmatched.push(steamName.trim());
    } else if (!matched.includes(genre)) {
      matched.push(genre);
    }
  }
  return { matched, unmatched };
}

/** Translation key for a failed Steam lookup, from the API's stable error codes. */
export function steamAutofillErrorKey(err: unknown): string {
  const message = err instanceof HttpErrorResponse ? (err.error as { message?: unknown } | null)?.message : null;
  switch (message) {
    case 'STEAM_APP_NOT_FOUND':
      return 'game.steamAutofill.errors.notFound';
    case 'STEAM_APP_NOT_A_GAME':
      return 'game.steamAutofill.errors.notAGame';
    default:
      return 'game.steamAutofill.errors.unavailable';
  }
}
