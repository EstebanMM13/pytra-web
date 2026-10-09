import { Platform } from './experience.model';

export interface StatsSummary {
  totalGames: number;
  totalSagas: number;
  totalExperiences: number;
  totalSingleplayerHours: number;
  totalOnlineHours: number;
  totalPlatinums: number;
  /** Mean rating of rated runs (null when nothing is rated). */
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

export interface TopRatedExperience {
  gameId: number;
  gameName: string;
  runLabel: string;
  rating: number;
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
  platform: Platform;
  startDate: string | null;
  hours: number | null;
  updatedAt: string;
}
