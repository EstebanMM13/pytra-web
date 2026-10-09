export interface StatsSummary {
  totalGames: number;
  totalSagas: number;
  totalExperiences: number;
  totalSingleplayerHours: number;
  totalOnlineHours: number;
  totalPlatinums: number;
}

export interface YearStat {
  year: number;
  totalHours: number;
  experienceCount: number;
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
