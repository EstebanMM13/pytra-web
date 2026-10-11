import { HttpErrorResponse } from '@angular/common/http';
import { Genre } from '../../../core/models/genre.model';
import { IgdbSearchResult } from '../../../core/models/igdb-metadata.model';
import { SteamStoreSearchResult } from '../../../core/models/steam-metadata.model';

/** Where the game form can be prefilled from. */
export type AutofillSource = 'igdb' | 'steam';

/** Brand names shown in the UI (not translated). */
export const AUTOFILL_SOURCE_LABELS: Record<AutofillSource, string> = { igdb: 'IGDB', steam: 'Steam' };

/** Shortest query the API accepts for a metadata search. */
export const AUTOFILL_SEARCH_MIN_LENGTH = 2;

/** A search hit of any source, as the result list shows it. */
export interface AutofillResult {
  id: number;
  name: string;
  imageUrl: string | null;
  year: number | null;
  platforms: string[];
}

/** Game form values from any source (Steam and IGDB details share this shape). */
export interface AutofillMetadata {
  name: string;
  developer: string | null;
  publisher: string | null;
  releaseDate: string | null;
  genres: string[];
  coverImageUrl: string | null;
}

/** What the autofill panel emits: the metadata plus where it came from. */
export interface AutofillPick {
  source: AutofillSource;
  metadata: AutofillMetadata;
}

export function fromSteamResult(result: SteamStoreSearchResult): AutofillResult {
  return { id: result.appId, name: result.name, imageUrl: result.imageUrl, year: null, platforms: [] };
}

export function fromIgdbResult(result: IgdbSearchResult): AutofillResult {
  return {
    id: result.igdbId,
    name: result.name,
    imageUrl: result.imageUrl,
    year: result.year,
    platforms: result.platforms ?? [],
  };
}

/** Second line of a result row: "2017 · Switch, Wii U"; empty when there is nothing to tell. */
export function resultDetails(result: AutofillResult): string {
  const platforms = result.platforms.join(', ');
  return [result.year === null ? '' : String(result.year), platforms].filter(Boolean).join(' · ');
}

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
 * Well-known equivalents of source genre names (keys from {@link genreKey}), tried in order after
 * the name itself, so a user who named genres in Spanish, English or with the usual acronym still
 * gets a match. Steam genres arrive in Spanish ("Rol"); IGDB genres in English ("Role-playing (RPG)").
 */
const GENRE_ALIASES: Record<string, readonly string[]> = {
  // Steam (Spanish store)
  ACCION: ['ACTION'],
  AVENTURA: ['ADVENTURE'],
  ROL: ['RPG', 'ROLE-PLAYING', 'ROLE PLAYING'],
  ESTRATEGIA: ['STRATEGY'],
  SIMULADORES: ['SIMULACION', 'SIMULADOR', 'SIMULATION'],
  DEPORTES: ['SPORTS', 'DEPORTE'],
  CARRERAS: ['RACING', 'CONDUCCION'],
  'MULTIJUGADOR MASIVO': ['MMO', 'MASSIVELY MULTIPLAYER'],
  // IGDB (English)
  'ROLE-PLAYING (RPG)': ['ROL', 'RPG', 'ROLE-PLAYING', 'ROLE PLAYING'],
  ADVENTURE: ['AVENTURA'],
  PLATFORM: ['PLATAFORMAS', 'PLATAFORMA', 'PLATFORMER', 'PLATFORMS'],
  SHOOTER: ['DISPAROS'],
  PUZZLE: ['PUZLES', 'PUZLE', 'PUZZLES', 'ROMPECABEZAS'],
  RACING: ['CARRERAS', 'CONDUCCION'],
  SPORT: ['DEPORTES', 'DEPORTE', 'SPORTS'],
  STRATEGY: ['ESTRATEGIA'],
  FIGHTING: ['LUCHA', 'PELEA', 'PELEAS'],
  "HACK AND SLASH/BEAT 'EM UP": ['HACK AND SLASH', "BEAT 'EM UP", "HACK 'N' SLASH", 'BEAT EM UP'],
  SIMULATOR: ['SIMULACION', 'SIMULADORES', 'SIMULADOR', 'SIMULATION'],
  'POINT-AND-CLICK': ['AVENTURA GRAFICA', 'POINT AND CLICK'],
  MUSIC: ['MUSICA', 'MUSICAL', 'RITMO'],
  'TURN-BASED STRATEGY (TBS)': ['ESTRATEGIA POR TURNOS', 'TURNOS', 'TBS', 'ESTRATEGIA'],
  'REAL TIME STRATEGY (RTS)': ['ESTRATEGIA EN TIEMPO REAL', 'RTS', 'ESTRATEGIA'],
  TACTICAL: ['TACTICO', 'TACTICA', 'TACTICOS'],
  'VISUAL NOVEL': ['NOVELA VISUAL'],
  'CARD & BOARD GAME': ['CARTAS', 'JUEGOS DE CARTAS', 'JUEGOS DE MESA', 'CARD GAME'],
  'QUIZ/TRIVIA': ['PREGUNTAS', 'TRIVIAL', 'TRIVIA'],
};

/**
 * Name offered as a "+ genre" chip when the user has no match. IGDB's English names become the
 * Spanish genre the user would have typed; anything else (Steam's Spanish names, "Indie", "Arcade",
 * "MOBA"...) is suggested as is.
 */
const SUGGESTED_NAMES: Record<string, string> = {
  'ROLE-PLAYING (RPG)': 'Rol',
  ADVENTURE: 'Aventura',
  PLATFORM: 'Plataformas',
  PUZZLE: 'Puzles',
  RACING: 'Carreras',
  SPORT: 'Deportes',
  STRATEGY: 'Estrategia',
  FIGHTING: 'Lucha',
  "HACK AND SLASH/BEAT 'EM UP": 'Hack and slash',
  SIMULATOR: 'Simulación',
  'POINT-AND-CLICK': 'Aventura gráfica',
  MUSIC: 'Música',
  'TURN-BASED STRATEGY (TBS)': 'Estrategia por turnos',
  'REAL TIME STRATEGY (RTS)': 'Estrategia en tiempo real',
  TACTICAL: 'Táctico',
  'VISUAL NOVEL': 'Novela visual',
  'CARD & BOARD GAME': 'Cartas',
  'QUIZ/TRIVIA': 'Preguntas',
};

export interface GenreMatch {
  /** User genres that correspond to some source genre (each at most once, in the source's order). */
  matched: Genre[];
  /** Genre names with no user genre, offered as one-click suggestions (Spanish for IGDB's well-known ones). */
  unmatched: string[];
}

/** Maps source genre names (Steam or IGDB) onto the user's own genres, case-, accent- and alias-insensitively. */
export function matchGenres(sourceGenres: readonly string[], userGenres: readonly Genre[]): GenreMatch {
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
  const suggested = new Set<string>();
  for (const sourceName of sourceGenres) {
    const key = genreKey(sourceName);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const genre = [key, ...(GENRE_ALIASES[key] ?? [])].map((k) => byKey.get(k)).find((g) => g !== undefined);
    if (genre) {
      if (!matched.includes(genre)) {
        matched.push(genre);
      }
      continue;
    }
    // Two IGDB genres can suggest the same Spanish name (e.g. both strategies): offer it once.
    const suggestion = SUGGESTED_NAMES[key] ?? sourceName.trim();
    if (!suggested.has(genreKey(suggestion))) {
      suggested.add(genreKey(suggestion));
      unmatched.push(suggestion);
    }
  }
  return { matched, unmatched };
}

/** Translation key for a failed metadata lookup, from the API's stable error codes. */
export function autofillErrorKey(err: unknown): string {
  const message = err instanceof HttpErrorResponse ? (err.error as { message?: unknown } | null)?.message : null;
  switch (message) {
    case 'STEAM_APP_NOT_FOUND':
    case 'IGDB_GAME_NOT_FOUND':
      return 'game.autofill.errors.notFound';
    case 'STEAM_APP_NOT_A_GAME':
      return 'game.autofill.errors.notAGame';
    default:
      return 'game.autofill.errors.unavailable';
  }
}
