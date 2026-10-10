import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Experience, ExperienceRequest, ExperienceStatus, Platform } from '../../../core/models/experience.model';
import { RatingPrecision } from '../../../core/services/preferences.service';
import { decimalValidator, parseDecimal } from '../../../shared/utils/decimal-input';

/** Pure helpers behind the run form: validation, defaults and request building. */

export const RUN_STATUSES: readonly ExperienceStatus[] = ['EN_CURSO', 'COMPLETADO', 'ABANDONADO', 'PENDIENTE'];
export const RUN_PLATFORMS: readonly Platform[] = ['PC', 'PS5', 'PS4', 'XBOX', 'SWITCH', 'MOBILE'];

/** Default label for a new run of a game that already has `existingRuns` runs. */
export function nextRunLabel(existingRuns: number): string {
  return `Run ${Math.max(0, existingRuns) + 1}`;
}

/**
 * 0–10 following the rating precision: `integer` (9), `half` (9 or 9.5) or `hundredths` (up to two
 * decimals, the API limit). Empty is valid (a run in progress has no rating yet).
 */
export function isValidRating(value: number | null | undefined, precision: RatingPrecision = 'hundredths'): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (!Number.isFinite(value) || value < 0 || value > 10) {
    return false;
  }
  const factor = precision === 'integer' ? 1 : precision === 'half' ? 2 : 100;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

/**
 * Rating validator for the text input ("9,25" or "9.25"). Unparsable text is an error.
 * `keep` is a value accepted regardless of the precision (the stored rating of a run being
 * edited, so changing the preference never blocks saving an untouched rating).
 */
export function ratingValidatorFor(
  precision: () => RatingPrecision,
  keep: () => number | null = () => null,
): ValidatorFn {
  return decimalValidator('rating', (value) => value === keep() ? isValidRating(value) : isValidRating(value, precision()));
}

/** Default rating validator (two decimals). */
export const ratingValidator: ValidatorFn = ratingValidatorFor(() => 'hundredths');

/** Hours are optional; when present they must be a number ≥ 0 ("12,5" accepted). */
export const hoursValidator: ValidatorFn = decimalValidator('hours', (value) => value >= 0);

/** ISO `yyyy-mm-dd` strings compare correctly as text. */
export function isValidDateRange(start: string | null | undefined, end: string | null | undefined): boolean {
  return !start || !end || end >= start;
}

/** Group validator: `endDate` must not be before `startDate`. */
export const dateRangeValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const start = group.get('startDate')?.value as string | null;
  const end = group.get('endDate')?.value as string | null;
  return isValidDateRange(start, end) ? null : { dateRange: true };
};

function yearOf(date: string | null | undefined): number | null {
  const match = /^(\d{4})-/.exec(date ?? '');
  return match ? Number(match[1]) : null;
}

/**
 * Value for `ExperienceRequest.year`. The form has no year field: the API resolves a run's year as
 * "explicit year, else end date, else start date" (ExperiencePeriod), so:
 * - when editing and both dates are unchanged, the stored year is kept as is (it may have been typed
 *   on purpose, e.g. runs imported without dates);
 * - otherwise it is derived from the end date, else the start date, else the stored year (if any).
 */
export function deriveRunYear(
  dates: { startDate: string | null; endDate: string | null },
  original?: Pick<Experience, 'year' | 'startDate' | 'endDate'> | null,
): number | null {
  if (
    original &&
    (original.startDate ?? null) === (dates.startDate ?? null) &&
    (original.endDate ?? null) === (dates.endDate ?? null)
  ) {
    return original.year ?? null;
  }
  return yearOf(dates.endDate) ?? yearOf(dates.startDate) ?? original?.year ?? null;
}

/** Raw form value, as the run form's FormGroup holds it. */
export interface RunFormValue {
  runLabel: string;
  status: ExperienceStatus;
  platform: Platform;
  startDate: string;
  endDate: string;
  /** Raw text of the decimal inputs ("12,5"); parsed when building the request. */
  hours: string;
  rating: string;
  summary: string;
  platinum: boolean;
  replay: boolean;
  pros: string;
  cons: string;
  notes: string;
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Parsed decimal, or null when empty or invalid (validators block invalid text before submit). */
function numberOrNull(text: string | number | null | undefined): number | null {
  const value = parseDecimal(text);
  return value === null || Number.isNaN(value) ? null : value;
}

/** Maps the form value to the API request (empty strings become null, year is derived). */
export function buildExperienceRequest(
  value: RunFormValue,
  original?: Pick<Experience, 'year' | 'startDate' | 'endDate'> | null,
): ExperienceRequest {
  const startDate = value.startDate || null;
  const endDate = value.endDate || null;
  return {
    runLabel: value.runLabel.trim(),
    year: deriveRunYear({ startDate, endDate }, original),
    status: value.status,
    rating: numberOrNull(value.rating),
    hours: numberOrNull(value.hours),
    startDate,
    endDate,
    platform: value.platform,
    platinum: value.platinum,
    replay: value.replay,
    summary: textOrNull(value.summary),
    pros: textOrNull(value.pros),
    cons: textOrNull(value.cons),
    notes: textOrNull(value.notes),
  };
}
