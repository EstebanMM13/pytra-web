import type { RatingPrecision } from '../../core/services/preferences.service';
import { formatDecimalInput } from './decimal-input';
import { formatRating, roundHalfUp } from './rating-format';
import { RatingScale, ratingScaleMax } from './rating-scale-options';

export { RATING_SCALES, ratingScaleMax } from './rating-scale-options';
export type { RatingScale } from './rating-scale-options';

/** Decimals the API stores a rating with (NUMERIC(4,2), `@Digits(fraction = 2)`). */
const STORED_DECIMALS = 2;

/** Stored 0–10 rating -> value on `scale` (8.7 -> 87 on 0–100, 4.35 on 0–5). Drift-free, unrounded otherwise. */
export function toRatingScale(stored: number, scale: RatingScale): number {
  // Six decimals clears float drift (0.07 * 100) without losing any stored precision.
  return roundHalfUp((stored * ratingScaleMax(scale)) / 10, 6);
}

/**
 * Value typed on `scale` -> stored 0–10 rating, rounded half up to the two decimals the API accepts
 * (87 -> 8.7 and 87.5 -> 8.75 on 0–100; 4.3 -> 8.6 and 4.25 -> 8.5 on 0–5).
 */
export function fromRatingScale(value: number, scale: RatingScale): number {
  return roundHalfUp((value * 10) / ratingScaleMax(scale), STORED_DECIMALS);
}

/**
 * Decimals a rating is shown with on a scale for a precision preference:
 * - 0–10 and 0–5: 0 / 1 / 2 (9 / 9.5 / 9.25 and 4 / 4.5 / 4.25);
 * - 0–100: 0 / 1 / 1 (87 / 87.5 / 87.5): one decimal on 0–100 already is the stored hundredth.
 */
export function scaledRatingDecimals(scale: RatingScale, precision: RatingPrecision): 0 | 1 | 2 {
  if (precision === 'integer') return 0;
  if (precision === 'half') return 1;
  return scale === '100' ? 1 : 2;
}

/** Smallest step a rating can be typed with on a scale: 1 / 0.5 / 0.01 (0.1 on 0–100). */
export function scaledRatingStep(scale: RatingScale, precision: RatingPrecision): number {
  if (precision === 'integer') return 1;
  if (precision === 'half') return 0.5;
  return scale === '100' ? 0.1 : 0.01;
}

/**
 * Whether `value` (typed on `scale`) is a valid rating: 0..max in steps of the precision. Empty is
 * valid (a run in progress has no rating yet). Every valid value converts to a stored rating with at
 * most two decimals (0.1 on 0–100 is 0.01, 0.01 on 0–5 is 0.02).
 */
export function isValidScaledRating(
  value: number | null | undefined,
  scale: RatingScale,
  precision: RatingPrecision,
): boolean {
  if (value === null || value === undefined) return true;
  if (!Number.isFinite(value) || value < 0 || value > ratingScaleMax(scale)) return false;
  const perUnit = Math.round(1 / scaledRatingStep(scale, precision));
  return Math.abs(value * perUnit - Math.round(value * perUnit)) < 1e-6;
}

/**
 * Whether a rating typed on `scale` is valid, following the precision. A value that converts back
 * to `keep` (the stored rating of the run being edited) only has to be in range, so changing the
 * precision or scale preference never blocks saving an untouched rating.
 */
export function isValidTypedRating(
  value: number,
  scale: RatingScale,
  precision: RatingPrecision,
  keep: number | null = null,
): boolean {
  if (keep !== null && Number.isFinite(value) && value >= 0 && value <= ratingScaleMax(scale)) {
    if (fromRatingScale(value, scale) === keep) return true;
  }
  return isValidScaledRating(value, scale, precision);
}

/** Display text for a stored 0–10 rating on a scale ("87,5" on 0–100, "4,25" on 0–5); missing -> "—". */
export function formatScaledRating(
  stored: number | null | undefined,
  scale: RatingScale,
  precision: RatingPrecision,
  locale = 'es-ES',
): string {
  if (stored === null || stored === undefined || !Number.isFinite(stored)) return '—';
  return formatRating(toRatingScale(stored, scale), scaledRatingDecimals(scale, precision), locale);
}

/** A plain number on a scale for copy ("a 10" -> "a 100" / "a 5"; 9 -> "4,5" on 0–5), trailing zeros trimmed. */
export function formatScaledPoint(stored: number, scale: RatingScale, lang: string): string {
  return formatDecimalInput(toRatingScale(stored, scale), lang);
}

/** Text an input starts with for a stored rating: the exact scaled value ("8,75" -> "87,5" on 0–100). */
export function scaledRatingDraft(stored: number | null | undefined, scale: RatingScale, lang: string): string {
  return stored === null || stored === undefined || !Number.isFinite(stored)
    ? ''
    : formatDecimalInput(toRatingScale(stored, scale), lang);
}

/** Example values per precision on each scale, used in placeholders and error messages. */
const EXAMPLES: Record<RatingScale, Record<RatingPrecision, number>> = {
  '10': { integer: 9, half: 9.5, hundredths: 9.25 },
  '100': { integer: 92, half: 92.5, hundredths: 92.5 },
  '5': { integer: 4, half: 4.5, hundredths: 4.25 },
};

/** Interpolation params for the rating input copy: `max` ("100"), `example` ("92,5"), `whole` ("92"). */
export function ratingInputParams(
  scale: RatingScale,
  precision: RatingPrecision,
  lang: string,
): { max: string; example: string; whole: string } {
  return {
    max: String(ratingScaleMax(scale)),
    example: formatDecimalInput(EXAMPLES[scale][precision], lang),
    whole: formatDecimalInput(EXAMPLES[scale].integer, lang),
  };
}
