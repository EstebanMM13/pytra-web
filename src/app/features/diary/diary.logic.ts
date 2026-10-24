import { HttpErrorResponse } from '@angular/common/http';
import {
  DIARY_RUN_REQUIRED,
  DiaryDay,
  DiaryDayRequest,
  INVALID_DIARY_RUN,
} from '../../core/models/diary.model';
import { Game, GameCategory } from '../../core/models/game.model';
import { InProgressExperience } from '../../core/models/stats.model';
import { formatHoursInput, parseDecimal } from '../../shared/utils/decimal-input';
import { RUN_DATE_MIN, runDateMax } from '../../shared/utils/run-dates';

/** Pure helpers behind the play diary: the month calendar, the day editor's draft and its payload. */

/** Most hours one game can take in a day (the API's limit). */
export const MAX_DIARY_HOURS = 24;

/** Heat level of a calendar day: 0 nothing played, 1..4 more hours. */
export type DiaryLevel = 0 | 1 | 2 | 3 | 4;

/** Upper bounds (exclusive) of levels 1, 2 and 3; anything above is level 4. */
const LEVEL_BOUNDS: readonly number[] = [1, 3, 6];

/** Heat level for a day's total hours. */
export function intensityLevel(hours: number | null | undefined): DiaryLevel {
  const h = hours ?? 0;
  if (!(h > 0)) return 0;
  const index = LEVEL_BOUNDS.findIndex((bound) => h < bound);
  return (index === -1 ? 4 : index + 1) as DiaryLevel;
}

export interface CalendarCell {
  /** `yyyy-mm-dd`. */
  date: string;
  day: number;
  /** Belongs to the shown month (leading/trailing days of the neighbour months are false). */
  inMonth: boolean;
  isToday: boolean;
  /** Later than the last date the API accepts (tomorrow): not selectable. */
  disabled: boolean;
  hours: number;
  level: DiaryLevel;
  /** The day has an entry (games or a note), even with no hours. */
  hasEntry: boolean;
  gameCount: number;
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function fromUtc(date: Date): string {
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** `{ year, month }` (month 1..12) moved by `delta` months. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** `{ year, month }` of an ISO date; null when it is not one. */
export function monthOf(iso: string | null | undefined): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!match) return null;
  const month = +match[2];
  return month >= 1 && month <= 12 ? { year: +match[1], month } : null;
}

/** First and last date of the 6-week grid shown for a month (weeks start on Monday). */
export function gridRange(year: number, month: number): { from: string; to: string } {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month - 1, 1 - offset));
  const end = new Date(Date.UTC(year, month - 1, 1 - offset + 41));
  return { from: fromUtc(start), to: fromUtc(end) };
}

/**
 * The month as 6 weeks of 7 days (Monday first), each day with the hours of its diary entry.
 * `today` and `max` are ISO dates (max: last selectable day, tomorrow by default).
 */
export function buildMonthGrid(
  year: number,
  month: number,
  days: readonly DiaryDay[],
  today: string,
  max: string = runDateMax(),
): CalendarCell[][] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const start = gridRange(year, month).from;
  const [sy, sm, sd] = start.split('-').map(Number);
  const weeks: CalendarCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(Date.UTC(sy, sm - 1, sd + w * 7 + d));
      const iso = fromUtc(date);
      const entry = byDate.get(iso);
      const hours = entry?.totalHours ?? 0;
      week.push({
        date: iso,
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() + 1 === month,
        isToday: iso === today,
        disabled: iso > max || iso < RUN_DATE_MIN,
        hours,
        level: intensityLevel(hours),
        hasEntry: !!entry,
        gameCount: entry?.games.length ?? 0,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

/** Total hours of the month's own days (neighbour-month days in the grid are left out). */
export function monthTotal(days: readonly DiaryDay[], year: number, month: number): number {
  const prefix = `${year}-${pad(month)}-`;
  return round2(
    days.filter((d) => d.date.startsWith(prefix)).reduce((sum, d) => sum + (d.totalHours ?? 0), 0),
  );
}

/** Short weekday names, Monday first, in `locale`. */
export function weekdayLabels(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    format.format(new Date(Date.UTC(2024, 0, 1 + i))).replace('.', ''),
  );
}

/** "octubre de 2026" / "October 2026". */
export function monthLabel(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** "sáb, 24 oct" / "Sat, Oct 24" (with the year when it is not `currentYear`). */
export function dayLabel(iso: string, locale: string, currentYear?: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  };
  if (currentYear !== undefined && y !== currentYear) options.year = 'numeric';
  return new Intl.DateTimeFormat(locale, options).format(new Date(Date.UTC(y, m - 1, d)));
}

/** A selectable diary date: an ISO date from 1970-01-01 to `max` (tomorrow), like run dates. */
export function isValidDiaryDate(
  value: string | null | undefined,
  max: string = runDateMax(),
): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= RUN_DATE_MIN && value <= max;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Hours typed for a game: more than 0, at most 24, with up to two decimals ("1,5" accepted). */
export function parseDiaryHours(text: string): number | null {
  const value = parseDecimal(text);
  if (value === null || Number.isNaN(value) || value <= 0 || value > MAX_DIARY_HOURS) return null;
  return round2(value) === value ? value : null;
}

/** "1,5 h" / "1.5 h": up to two decimals (the diary keeps quarter hours). */
export function formatDiaryHours(value: number | null | undefined, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value ?? 0)} h`;
}

/** A game row of the day editor. */
export interface DiaryDraftGame {
  gameId: number;
  gameName: string;
  coverImageUrl: string | null;
  category: GameCategory | null;
  experienceId: number | null;
  runLabel: string | null;
  hoursText: string;
  note: string;
  /** Known from a saved day: the platform sync counts this game's hours. */
  synced: boolean;
}

/** Editor rows for a saved day (names and categories completed from the library when known). */
export function draftFromDay(
  day: DiaryDay,
  library: readonly Game[],
  lang: string,
): DiaryDraftGame[] {
  const games = new Map(library.map((g) => [g.id, g]));
  return day.games.map((line) => {
    const game = games.get(line.gameId);
    return {
      gameId: line.gameId,
      gameName: line.gameName ?? game?.name ?? '',
      coverImageUrl: line.coverImageUrl ?? game?.coverImageUrl ?? null,
      category: game?.category ?? null,
      experienceId: line.experienceId,
      runLabel: line.runLabel,
      hoursText: formatHoursInput(line.hours, lang),
      note: line.note ?? '',
      synced: line.synced,
    };
  });
}

/** A new editor row for a library game. */
export function draftForGame(
  game: Pick<Game, 'id' | 'name' | 'coverImageUrl' | 'category'>,
  hoursText = '',
): DiaryDraftGame {
  return {
    gameId: game.id,
    gameName: game.name,
    coverImageUrl: game.coverImageUrl,
    category: game.category,
    experienceId: null,
    runLabel: null,
    hoursText,
    note: '',
    synced: false,
  };
}

export type DiaryRequestResult =
  | { ok: true; request: DiaryDayRequest }
  /** Indexes of the rows whose hours are missing or invalid. */
  | { ok: false; invalid: number[] };

/** The PUT body for the editor's state, or the rows that block it. */
export function toDayRequest(note: string, games: readonly DiaryDraftGame[]): DiaryRequestResult {
  const invalid: number[] = [];
  const request: DiaryDayRequest = { note: note.trim() || null, games: [] };
  games.forEach((game, index) => {
    const hours = parseDiaryHours(game.hoursText);
    if (hours === null) {
      invalid.push(index);
      return;
    }
    request.games.push({
      gameId: game.gameId,
      ...(game.experienceId !== null ? { experienceId: game.experienceId } : {}),
      hours,
      note: game.note.trim() || null,
    });
  });
  return invalid.length ? { ok: false, invalid } : { ok: true, request };
}

/**
 * Rows the API could not place on a run (400 DIARY_RUN_REQUIRED / INVALID_DIARY_RUN), from its
 * `games[i].experienceId` field errors; null when the error is something else.
 */
export function runErrorIndexes(err: unknown): number[] | null {
  if (!(err instanceof HttpErrorResponse) || err.status !== 400) return null;
  const body = (err.error ?? null) as { message?: unknown; fieldErrors?: unknown } | null;
  if (body?.message !== DIARY_RUN_REQUIRED && body?.message !== INVALID_DIARY_RUN) return null;
  const fields =
    body.fieldErrors && typeof body.fieldErrors === 'object' ? Object.keys(body.fieldErrors) : [];
  return fields
    .map((field) => /^games\[(\d+)\]\.experienceId$/.exec(field)?.[1])
    .filter((index): index is string => index !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
}

/** Lower-case, accent-free text for searching names. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Library games matching `query` (name contains it, accents ignored), excluding `exclude`, best first. */
export function searchLibrary(
  games: readonly Game[],
  query: string,
  exclude: ReadonlySet<number>,
  limit = 8,
): Game[] {
  const q = fold(query);
  if (!q) return [];
  return games
    .filter((g) => !exclude.has(g.id) && g.reviewStatus !== 'PENDING_REVIEW')
    .map((g) => ({ g, at: fold(g.name).indexOf(q) }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at || a.g.name.localeCompare(b.g.name))
    .slice(0, limit)
    .map(({ g }) => g);
}

/** "Playing now" quick chips: one per game with a run in progress, not already in the day. */
export function playingNowGames(
  runs: readonly InProgressExperience[],
  exclude: ReadonlySet<number>,
): Pick<Game, 'id' | 'name' | 'coverImageUrl'>[] {
  const seen = new Set<number>();
  const chips: Pick<Game, 'id' | 'name' | 'coverImageUrl'>[] = [];
  for (const run of runs) {
    if (exclude.has(run.gameId) || seen.has(run.gameId)) continue;
    seen.add(run.gameId);
    chips.push({ id: run.gameId, name: run.gameName, coverImageUrl: run.coverImageUrl });
  }
  return chips;
}

/** Sum of the valid hours typed in the editor. */
export function draftTotal(games: readonly DiaryDraftGame[]): number {
  return round2(games.reduce((sum, g) => sum + (parseDiaryHours(g.hoursText) ?? 0), 0));
}
