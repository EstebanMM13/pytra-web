// Split from rating-scale.ts so PreferencesService (in the initial bundle) does not pull the
// rating formatting helpers in with it; rating-scale.ts re-exports everything here.

/**
 * Scale ratings are shown and typed on. Ratings are always stored (and sent to the API) on 0–10
 * with up to two decimals; the scale only converts at the UI boundary.
 */
export type RatingScale = '10' | '100' | '5';

export const RATING_SCALES: readonly RatingScale[] = ['10', '100', '5'];

/** Upper bound of a scale: 10, 100 or 5. */
export function ratingScaleMax(scale: RatingScale): number {
  return scale === '100' ? 100 : scale === '5' ? 5 : 10;
}
