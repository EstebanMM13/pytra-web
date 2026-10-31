import { LegacyPlatformCode } from './platform.model';

export type ExperienceStatus = 'EN_CURSO' | 'COMPLETADO' | 'ABANDONADO' | 'PENDIENTE';

export interface Experience {
  id: number;
  gameId: number;
  runLabel: string;
  year: number | null;
  status: ExperienceStatus;
  rating: number | null;
  hours: number | null;
  startDate: string | null;
  endDate: string | null;
  /** Legacy enum code, kept by the API for old clients; use the platformId/Name/Color fields. */
  platform: LegacyPlatformCode;
  platformId: number;
  platformName: string;
  platformColor: string | null;
  platinum: boolean;
  /** "100%": every trophy/achievement of the game obtained. Independent of `platinum`. */
  fullCompletion: boolean;
  replay: boolean;
  /**
   * Beaten (COMPLETADO) but still being played: the postgame. Always false on other statuses.
   * Optional: absent from an API deployed before the postgame existed.
   */
  postgame?: boolean;
  /** Date (`yyyy-MM-dd`) the postgame ended; setting it ends the postgame. */
  postgameEndDate?: string | null;
  summary: string | null;
  pros: string | null;
  cons: string | null;
  notes: string | null;
  updatedAt: string;
}

/**
 * Partial update of a run's figures (PATCH): only the sent fields change. A missing `hours` keeps the
 * stored hours; `rating: null` clears the rating, a missing `rating` keeps it.
 */
export interface ExperiencePatch {
  hours?: number;
  rating?: number | null;
}

export interface ExperienceRequest {
  runLabel: string;
  year?: number | null;
  status: ExperienceStatus;
  rating?: number | null;
  hours?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  /** Catalog platform id. */
  platformId: number;
  platinum?: boolean;
  fullCompletion?: boolean;
  replay?: boolean;
  /** Only kept on COMPLETADO runs, and only while `postgameEndDate` is empty. */
  postgame?: boolean;
  /** Not before `endDate`; the API drops it on runs that are not COMPLETADO. */
  postgameEndDate?: string | null;
  summary?: string | null;
  pros?: string | null;
  cons?: string | null;
  notes?: string | null;
}
