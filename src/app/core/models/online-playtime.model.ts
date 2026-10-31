import { PlatformRef } from './platform.model';

export interface OnlinePlaytime {
  id: number;
  gameId: number;
  totalHours: number;
  lastSessionAt: string | null;
  generalRating: number | null;
  notes: string | null;
  /** Catalog platforms played online on, in catalog order (absent from older API versions). */
  platforms?: PlatformRef[] | null;
  /** Set by the user only (never by a platform sync); absent from older API versions. */
  platinum?: boolean;
  /** "100%": every trophy/achievement obtained. Independent of `platinum`; absent from older API versions. */
  fullCompletion?: boolean;
  /**
   * Online hours the user assigned per platform id (JSON keys are strings): a breakdown of `totalHours`,
   * the rest being unassigned. Empty without a breakdown; absent from older API versions.
   */
  platformHours?: Record<string, number> | null;
}

export interface OnlinePlaytimeRequest {
  totalHours: number;
  lastSessionAt?: string | null;
  generalRating?: number | null;
  notes?: string | null;
  /** Omitted keeps the stored platforms; an empty list clears them. */
  platformIds?: number[];
  /** Omitted keeps the stored flag (false on create). */
  platinum?: boolean;
  /** Omitted keeps the stored flag (false on create). */
  fullCompletion?: boolean;
  /**
   * Hours per platform id, at most `totalHours` in all. Omitted keeps the stored breakdown; an empty
   * object clears it. The API drops it below two platforms.
   */
  platformHours?: Record<number, number>;
}
