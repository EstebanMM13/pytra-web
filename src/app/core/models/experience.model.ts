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
  replay: boolean;
  summary: string | null;
  pros: string | null;
  cons: string | null;
  notes: string | null;
  updatedAt: string;
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
  replay?: boolean;
  summary?: string | null;
  pros?: string | null;
  cons?: string | null;
  notes?: string | null;
}
