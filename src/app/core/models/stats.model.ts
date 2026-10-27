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

/** A diary day with hours, from `/stats/activity` (`date` is YYYY-MM-DD). */
export interface ActivityDay {
  date: string;
  hours: number;
  gameCount: number;
}

/** A run of consecutive play days; dates are null when there is none. */
export interface Streak {
  length: number;
  startDate: string | null;
  endDate: string | null;
}

/** Diary activity on one weekday (`dayOfWeek` 1..7, Monday = 1). */
export interface WeekdayActivity {
  dayOfWeek: number;
  name: string;
  daysPlayed: number;
  hours: number;
}

/**
 * `GET /stats/activity?year=`: the year's diary days (play days only, oldest first). Streaks are
 * all-time; the current one is alive while its last day is today or yesterday.
 */
export interface ActivityStats {
  year: number;
  totalHours: number;
  activeDays: number;
  days: ActivityDay[];
  currentStreak: Streak;
  longestStreak: Streak;
  /** Always 7 entries, Monday first. */
  weekdays: WeekdayActivity[];
}

export interface PlatformStat {
  platformId: number;
  name: string;
  color: string | null;
  family: string | null;
  /** Run hours plus online (diary) hours. */
  hours: number;
  runHours: number;
  onlineHours: number;
  gameCount: number;
  runCount: number;
  completedRunCount: number;
  ratedRunCount: number;
  averageRating: number | null;
}

export interface PlatformYearSlice {
  platformId: number;
  name: string;
  color: string | null;
  hours: number;
}

export interface PlatformYear {
  year: number;
  totalHours: number;
  unassignedOnlineHours: number;
  platforms: PlatformYearSlice[];
}

/** `GET /stats/by-platform?year=` (`year` null: all time). `byYear` always spans every year, oldest first. */
export interface PlatformStats {
  year: number | null;
  /** Online hours of games without a platform assigned. */
  unassignedOnlineHours: number;
  /** Most hours first. */
  platforms: PlatformStat[];
  byYear: PlatformYear[];
}

export interface DeveloperStat {
  developer: string;
  gameCount: number;
  hours: number;
  ratedGameCount: number;
  averageRating: number | null;
}

/** `GET /stats/by-developer` (all time). `topByRating` only ranks developers with `minRatedGames` rated games. */
export interface DeveloperStats {
  minRatedGames: number;
  topByHours: DeveloperStat[];
  topByRating: DeveloperStat[];
}

export interface ReleaseBucketStat {
  gameCount: number;
  hours: number;
  ratedGameCount: number;
  averageRating: number | null;
}

/** `decade` is the first year: 1990 covers 1990-1999. */
export interface ReleaseDecadeStat extends ReleaseBucketStat {
  decade: number;
}

export interface ReleaseYearStat extends ReleaseBucketStat {
  year: number;
}

/** `GET /stats/by-release-era` (all time). */
export interface ReleaseEraStats {
  byDecade: ReleaseDecadeStat[];
  byYear: ReleaseYearStat[];
  /** Games without a release date. */
  undatedGameCount: number;
}

export interface FinishedRun {
  experienceId: number;
  gameId: number;
  gameName: string;
  runLabel: string;
  days: number;
}

/** `maxDays` null: open-ended (366+). */
export interface DaysBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  count: number;
}

export interface TimeToFinish {
  sampleSize: number;
  averageDays: number | null;
  medianDays: number | null;
  fastest: FinishedRun | null;
  slowest: FinishedRun | null;
  /** Always 6: 0-7, 8-30, 31-90, 91-180, 181-365, 366+. */
  buckets: DaysBucket[];
}

export interface GenreAbandonment {
  genreId: number;
  genreName: string;
  completedCount: number;
  abandonedCount: number;
  /** 0..1 */
  abandonmentRate: number;
}

/** `maxHours` null: open-ended (60+). */
export interface HoursBucket {
  label: string;
  minHours: number;
  maxHours: number | null;
  runCount: number;
  ratedCount: number;
  averageRating: number | null;
}

/** `GET /stats/completion?year=` (`year` null: all time). */
export interface CompletionStats {
  year: number | null;
  completedCount: number;
  abandonedCount: number;
  replayCount: number;
  timeToFinish: TimeToFinish;
  abandonmentByGenre: GenreAbandonment[];
  /** Always 4: <10, 10-30, 30-60, 60+. */
  hoursBuckets: HoursBucket[];
}

/** Ratings in [from, to); the last bucket is [10, 10]. */
export interface RatingBucket {
  from: number;
  to: number;
  count: number;
}

export interface GenreRating {
  genreId: number;
  genreName: string;
  ratedCount: number;
  averageRating: number;
}

export interface PlatformRating {
  platformId: number;
  name: string;
  color: string | null;
  ratedCount: number;
  averageRating: number;
}

/** `GET /stats/ratings?year=` (`year` null: all time). */
export interface RatingStats {
  year: number | null;
  bucketSize: number;
  ratedCount: number;
  mean: number | null;
  median: number | null;
  standardDeviation: number | null;
  /** Always 21 buckets: [0, 0.5) .. [9.5, 10), then [10, 10]. */
  histogram: RatingBucket[];
  byGenre: GenreRating[];
  byPlatform: PlatformRating[];
}
