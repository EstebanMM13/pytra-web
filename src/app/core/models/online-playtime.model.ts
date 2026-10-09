export interface OnlinePlaytime {
  id: number;
  gameId: number;
  totalHours: number;
  lastSessionAt: string | null;
  generalRating: number | null;
  notes: string | null;
}

export interface OnlinePlaytimeRequest {
  totalHours: number;
  lastSessionAt?: string | null;
  generalRating?: number | null;
  notes?: string | null;
}
