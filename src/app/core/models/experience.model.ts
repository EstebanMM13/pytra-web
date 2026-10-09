export type ExperienceStatus = 'EN_CURSO' | 'COMPLETADO' | 'ABANDONADO' | 'PENDIENTE';
export type Platform = 'PC' | 'PS5' | 'PS4' | 'XBOX' | 'SWITCH' | 'MOBILE';

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
  platform: Platform;
  platinum: boolean;
  replay: boolean;
  summary: string | null;
  pros: string | null;
  cons: string | null;
  notes: string | null;
  updatedAt: string;
}

/** Campos que ExperienceForm necesita para precargar edición. */
export type ExperienceFormData = Pick<
  Experience,
  | 'runLabel' | 'year' | 'status' | 'rating' | 'hours' | 'startDate' | 'endDate'
  | 'platform' | 'platinum' | 'replay' | 'summary' | 'pros' | 'cons' | 'notes'
>;

export interface ExperienceRequest {
  runLabel: string;
  year?: number | null;
  status: ExperienceStatus;
  rating?: number | null;
  hours?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  platform: Platform;
  platinum?: boolean;
  replay?: boolean;
  summary?: string | null;
  pros?: string | null;
  cons?: string | null;
  notes?: string | null;
}
