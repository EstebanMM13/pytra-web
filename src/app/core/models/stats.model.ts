export interface StatsSummary {
  totalGames: number;
  totalSagas: number;
  totalExperiences: number;
  totalSingleplayerHours: number;
  totalOnlineHours: number;
  totalPlatinums: number;
  /** Mean rating of rated runs. Optional until the API ships it. */
  averageRating?: number | null;
}

export interface YearStat {
  year: number;
  totalHours: number;
  experienceCount: number;
  /** Mean rating of the year's rated runs. Optional until the API ships it. */
  averageRating?: number | null;
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
