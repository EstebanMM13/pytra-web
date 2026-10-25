import { ExperienceStatus } from './experience.model';
import { LegacyPlatformCode } from './platform.model';

export interface StatsSummary {
  totalGames: number;
  totalSagas: number;
  totalExperiences: number;
  totalSingleplayerHours: number;
  totalOnlineHours: number;
  totalPlatinums: number;
  totalFullCompletions: number;
  /** Mean of the run ratings and online ratings (null when nothing is rated). */
  averageRating: number | null;
  replayCount: number;
  completedCount: number;
  abandonedCount: number;
  inProgressCount: number;
}

export interface YearStat {
  year: number;
  totalHours: number;
  experienceCount: number;
  /** Mean rating of the year's rated runs (null when nothing is rated). */
  averageRating: number | null;
  /** Diary hours of the year counted into online playtime, included in `totalHours` (absent from older APIs). */
  onlineHours?: number;
}

export interface SagaStat {
  sagaId: number | null;
  sagaName: string;
  gameCount: number;
  totalHours: number;
}

export interface GenreStat {
  genreId: number;
  genreName: string;
  gameCount: number;
  totalHours: number;
}

/** A rated run, or a game's online playtime (`online: true`, no run label nor experience id). */
export interface TopRatedExperience {
  gameId: number;
  gameName: string;
  runLabel: string | null;
  rating: number;
  /** The run's id; null for online entries (absent from older API versions). */
  experienceId?: number | null;
  online?: boolean;
}

export interface MostPlayedGame {
  gameId: number;
  gameName: string;
  totalHours: number;
}

/** A run with status EN_CURSO, from `/stats/in-progress` (most recently started first). */
export interface InProgressExperience {
  experienceId: number;
  gameId: number;
  gameName: string;
  coverImageUrl: string | null;
  runLabel: string;
  /** Legacy enum code (old clients); use platformName/platformColor. */
  platform: LegacyPlatformCode;
  platformId: number;
  platformName: string;
  platformColor: string | null;
  startDate: string | null;
  hours: number | null;
  updatedAt: string;
}

/** One month of a year summary (`month` is 1-12). */
export interface MonthHours {
  month: number;
  hours: number;
}

/** A run counted in a year summary, ordered by rating desc (unrated last), then hours desc. */
export interface YearExperience {
  experienceId: number;
  gameId: number;
  gameName: string;
  coverImageUrl: string | null;
  runLabel: string;
  status: ExperienceStatus;
  hours: number | null;
  rating: number | null;
  platinum: boolean;
  fullCompletion: boolean;
  /** Legacy enum code (old clients); use platformName/platformColor. */
  platform: LegacyPlatformCode;
  platformId: number;
  platformName: string;
  platformColor: string | null;
  month: number | null;
  startDate: string | null;
  endDate: string | null;
}

/** A game ranked by its average rating over the year's completed runs. */
export interface RatedGame {
  gameId: number;
  gameName: string;
  avgRating: number;
  experienceCount: number;
  totalHours: number;
  /** The game's cover (absent from older API versions). */
  coverImageUrl?: string | null;
}

export interface RatedGameBrief {
  gameId: number;
  gameName: string;
  avgRating: number;
}

export interface YearSagaStat {
  sagaId: number;
  sagaName: string;
  experienceCount: number;
  gameCount: number;
  totalHours: number;
}

export interface YearGenreStat {
  genreId: number;
  genreName: string;
  experienceCount: number;
  gameCount: number;
  totalHours: number;
}

/** Free-text yearly review; both texts are null until the user writes one. */
export interface YearNote {
  summary: string | null;
  highlights: string | null;
  updatedAt: string | null;
}

export interface YearNoteRequest {
  summary: string | null;
  highlights: string | null;
}

/** An online game played in the year: its diary hours of that year counted into its online playtime. */
export interface YearOnlineGame {
  gameId: number;
  gameName: string;
  coverImageUrl: string | null;
  hours: number;
  /** Diary days of the year with hours counted for the game. */
  dayCount: number;
}

/** `GET /stats/years/{year}`: the year in review. */
export interface YearSummary {
  year: number;
  totalHours: number;
  experienceCount: number;
  completedCount: number;
  abandonedCount: number;
  averageRating: number | null;
  platinumCount: number;
  fullCompletionCount: number;
  /** Hours of runs in the year without a date inside it (no month bucket). */
  hoursWithoutMonth: number;
  /** Always 12 entries, January first. */
  months: MonthHours[];
  experiences: YearExperience[];
  goty: RatedGame | null;
  topRated: RatedGame[];
  mostPlayed: MostPlayedGame[];
  topSagas: YearSagaStat[];
  topGenres: YearGenreStat[];
  surprises: RatedGameBrief[];
  disappointments: RatedGameBrief[];
  note: YearNote;
  /**
   * Diary hours of the year counted into online playtime: included in `totalHours` and `months`, never
   * in the run counts (absent from older APIs).
   */
  onlineHours?: number;
  /** Online games with diary hours in the year, most hours first (absent from older APIs). */
  onlineGames?: YearOnlineGame[];
}
