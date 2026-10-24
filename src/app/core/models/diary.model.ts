/** A game of a diary day, as the API returns it. */
export interface DiaryGame {
  gameId: number;
  gameName: string | null;
  coverImageUrl: string | null;
  /** Run the hours were added to (null: online playtime, or not counted). */
  experienceId: number | null;
  runLabel: string | null;
  hours: number;
  note: string | null;
  /** The hours were added to the game's data (run or online playtime). */
  countsHours: boolean;
  /** Linked to Steam/PSN: the platform sync counts the real playtime instead. */
  synced: boolean;
}

/** A diary day (`date` is `yyyy-mm-dd`): its note, the hours played in total and its games. */
export interface DiaryDay {
  date: string;
  note: string | null;
  totalHours: number;
  games: DiaryGame[];
}

export interface DiaryGameRequest {
  gameId: number;
  /** Run to add the hours to; omitted when the game has a single run in progress (or is ONLINE / synced). */
  experienceId?: number | null;
  hours: number;
  note?: string | null;
}

/** The whole day (PUT replaces it). No games and no note deletes the day. */
export interface DiaryDayRequest {
  note: string | null;
  games: DiaryGameRequest[];
}

/** A day one game was played (the game detail's "days played"). */
export interface GameDiaryDay {
  date: string;
  hours: number;
  note: string | null;
  experienceId: number | null;
  countsHours: boolean;
}

/** API error codes of the diary. */
export const DIARY_RUN_REQUIRED = 'DIARY_RUN_REQUIRED';
export const INVALID_DIARY_RUN = 'INVALID_DIARY_RUN';
