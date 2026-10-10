import { Genre } from './genre.model';
import { ExperienceStatus, Platform } from './experience.model';

export type GameCategory = 'SINGLEPLAYER' | 'ONLINE' | 'HYBRID';
export type ReviewStatus = 'PENDING_REVIEW' | 'CONFIRMED';

export interface Game {
  id: number;
  name: string;
  developer: string | null;
  publisher: string | null;
  releaseDate: string | null;
  category: GameCategory | null;
  sagaId: number | null;
  sagaName: string | null;
  coverImageUrl: string | null;
  reviewStatus: ReviewStatus;
  genres: Genre[];
  updatedAt: string;

  // Aggregates over the game's runs, sent by GET /games and /games/{id};
  // null (or absent) on other responses such as Steam pending games.
  experienceCount?: number | null;
  totalHours?: number | null;
  bestRating?: number | null;
  lastExperienceStatus?: ExperienceStatus | null;
  lastPlayedYear?: number | null;
  hasPlatinum?: boolean | null;
  /** Platforms of the game's runs, in enum order; empty when it has no runs. */
  platforms?: Platform[] | null;
  /** Date (`yyyy-MM-dd`) of the most recent run activity; null when unknown. */
  lastPlayedAt?: string | null;
}

export interface GameRequest {
  name: string;
  developer?: string | null;
  publisher?: string | null;
  releaseDate?: string | null;
  category: GameCategory;
  sagaId?: number | null;
  coverImageUrl?: string | null;
  genreIds?: number[];
}
