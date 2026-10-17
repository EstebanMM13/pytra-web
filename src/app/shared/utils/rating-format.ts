import type { RatingPrecision } from '../../core/services/preferences.service';

/** Decimals every rating is shown with for a precision preference: 9 / 9.5 / 9.25 -> 0 / 1 / 2. */
export function ratingDecimals(precision: RatingPrecision): 0 | 1 | 2 {
  return precision === 'integer' ? 0 : precision === 'half' ? 1 : 2;
}

/** Rounds half up at `decimals` places, avoiding binary drift (9.995 -> 10.00, not 9.99). */
function roundHalfUp(value: number, decimals: number): number {
  const shifted = Number(`${value}e${decimals}`);
  return Number.isFinite(shifted)
    ? Number(`${Math.round(shifted)}e-${decimals}`)
    : Math.round(value * 10 ** decimals) / 10 ** decimals;
}

/**
 * The single display format for a 0–10 rating: a fixed number of decimals (dot separator),
 * e.g. 9.5 -> "9.50" with 2, 9.25 -> "9.3" with 1, 9.5 -> "10" with 0. Missing values -> "—".
 */
export function formatRating(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return roundHalfUp(value, decimals).toFixed(decimals);
}
