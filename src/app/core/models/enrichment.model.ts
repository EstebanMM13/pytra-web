/** Background IGDB fill of the user's pending games, as reported by GET /status (Steam and PSN alike). */
export interface EnrichmentProgress {
  active: boolean;
  /** Pending games looked at so far. */
  processed: number;
  /** Pending games the running fill will look at; 0 while it is still queued. */
  total: number;
}
