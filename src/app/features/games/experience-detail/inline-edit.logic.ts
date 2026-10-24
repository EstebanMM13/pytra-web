import { Experience, ExperiencePatch } from '../../../core/models/experience.model';
import { RatingPrecision } from '../../../core/services/preferences.service';
import { formatHoursInput, parseDecimal } from '../../../shared/utils/decimal-input';
import {
  RatingScale,
  fromRatingScale,
  isValidTypedRating,
  scaledRatingDraft,
} from '../../../shared/utils/rating-scale';

/** Pure helpers behind the inline edit of a run's hours and rating on the run detail page. */

export type InlineField = 'hours' | 'rating';

/** Quick steps offered while editing the hours. */
export const HOUR_STEPS: readonly number[] = [0.5, 1];

export type InlineEditResult =
  | { kind: 'unchanged' }
  | { kind: 'invalid' }
  | { kind: 'change'; patch: ExperiencePatch };

const UNCHANGED: InlineEditResult = { kind: 'unchanged' };
const INVALID: InlineEditResult = { kind: 'invalid' };

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Text the inline input starts with: the same formatting as the run form's inputs (rating on `scale`). */
export function inlineDraft(
  field: InlineField,
  experience: Pick<Experience, 'hours' | 'rating'>,
  lang: string,
  scale: RatingScale = '10',
): string {
  return field === 'hours'
    ? formatHoursInput(experience.hours, lang)
    : scaledRatingDraft(experience.rating, scale, lang);
}

/**
 * What saving the typed `text` means, with the run form's rules: hours are a number ≥ 0 ("12,5"
 * accepted; empty keeps the stored hours), the rating is typed on `scale` following the rating
 * precision (empty clears it) and patched on the stored 0–10 scale. Text that still shows the
 * stored value (hours compared at the two decimals the input shows) is `unchanged`, so an untouched
 * field never sends a request.
 */
export function parseInlineEdit(
  field: InlineField,
  text: string,
  experience: Pick<Experience, 'hours' | 'rating'>,
  precision: RatingPrecision,
  scale: RatingScale = '10',
): InlineEditResult {
  const value = parseDecimal(text);
  if (field === 'hours') {
    if (value === null) return UNCHANGED;
    if (Number.isNaN(value) || value < 0) return INVALID;
    return value === roundHours(experience.hours ?? 0) ? UNCHANGED : { kind: 'change', patch: { hours: value } };
  }
  if (value === null) {
    return experience.rating === null ? UNCHANGED : { kind: 'change', patch: { rating: null } };
  }
  if (Number.isNaN(value) || !isValidTypedRating(value, scale, precision, experience.rating)) return INVALID;
  const rating = fromRatingScale(value, scale);
  return rating === experience.rating ? UNCHANGED : { kind: 'change', patch: { rating } };
}

/**
 * Hours draft after a quick step: adds `step` to the typed value (or to `stored` while the text is
 * empty or invalid), rounded to two decimals and never below zero.
 */
export function bumpHoursDraft(text: string, stored: number | null, step: number, lang: string): string {
  const typed = parseDecimal(text);
  const base = typed === null || Number.isNaN(typed) || typed < 0 ? (stored ?? 0) : typed;
  return formatHoursInput(Math.max(0, roundHours(base + step)), lang);
}
