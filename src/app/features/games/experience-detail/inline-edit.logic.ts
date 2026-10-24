import { Experience, ExperiencePatch } from '../../../core/models/experience.model';
import { RatingPrecision } from '../../../core/services/preferences.service';
import { formatDecimalInput, formatHoursInput, parseDecimal } from '../../../shared/utils/decimal-input';
import { isValidRating } from '../run-form/run-form.logic';

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

/** Text the inline input starts with: the same formatting as the run form's inputs. */
export function inlineDraft(field: InlineField, experience: Pick<Experience, 'hours' | 'rating'>, lang: string): string {
  return field === 'hours' ? formatHoursInput(experience.hours, lang) : formatDecimalInput(experience.rating, lang);
}

/**
 * What saving the typed `text` means, with the run form's rules: hours are a number ≥ 0 ("12,5"
 * accepted; empty keeps the stored hours), the rating is 0–10 following the rating precision (empty
 * clears it). Text that still shows the stored value (hours compared at the two decimals the input
 * shows) is `unchanged`, so an untouched field never sends a request.
 */
export function parseInlineEdit(
  field: InlineField,
  text: string,
  experience: Pick<Experience, 'hours' | 'rating'>,
  precision: RatingPrecision,
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
  if (Number.isNaN(value)) return INVALID;
  if (value === experience.rating) return UNCHANGED;
  return isValidRating(value, precision) ? { kind: 'change', patch: { rating: value } } : INVALID;
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
