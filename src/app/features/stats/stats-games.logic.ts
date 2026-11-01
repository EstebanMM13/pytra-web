/** Short gems as the API ranks them: game rating at least this (stored 0-10 scale)... */
export const SHORT_GEM_MIN_RATING = 8;
/** ...over at most this many total hours. */
export const SHORT_GEM_MAX_HOURS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days a pending game has waited: from `since` (a local ISO date-time, as the API sends
 * it) to `now`, never negative.
 */
export function waitingDays(since: string, now: Date): number {
  const start = new Date(since);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / DAY_MS));
}
