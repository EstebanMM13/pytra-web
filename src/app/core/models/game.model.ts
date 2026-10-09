import { Genre } from './genre.model';

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
