import { Genre } from './genre.model';
import { ExperienceStatus } from './experience.model';
import { LegacyPlatformCode, PlatformRef } from './platform.model';

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
  /** Legacy enum codes of the game's platforms (kept by the API for old clients); use platformRefs. */
  platforms?: LegacyPlatformCode[] | null;
  /** Catalog platforms of the game's runs, in catalog order; empty when it has no runs. */
  platformRefs?: PlatformRef[] | null;
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
