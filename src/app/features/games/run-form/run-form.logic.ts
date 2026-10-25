import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Experience, ExperienceRequest, ExperienceStatus } from '../../../core/models/experience.model';
import { Game } from '../../../core/models/game.model';
import { RatingPrecision } from '../../../core/services/preferences.service';
import { decimalValidator, parseDecimal } from '../../../shared/utils/decimal-input';
import { isWithinRunDateLimits } from '../../../shared/utils/run-dates';
import { RatingScale, fromRatingScale, isValidTypedRating } from '../../../shared/utils/rating-scale';

/** Pure helpers behind the run form: validation, defaults and request building. */

export const RUN_STATUSES: readonly ExperienceStatus[] = ['EN_CURSO', 'COMPLETADO', 'ABANDONADO', 'PENDIENTE'];

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
 * Rating validator for the text input ("9,25" or "9.25"), typed on the rating scale. Unparsable
 * text is an error. `keep` is the stored rating accepted regardless of the precision (see
 * `isValidTypedRating`).
 */
export function ratingValidatorFor(
  precision: () => RatingPrecision,
  keep: () => number | null = () => null,
  scale: () => RatingScale = () => '10',
): ValidatorFn {
  return decimalValidator('rating', (value) => isValidTypedRating(value, scale(), precision(), keep()));
}

/** Default rating validator (two decimals). */
export const ratingValidator: ValidatorFn = ratingValidatorFor(() => 'hundredths');

/** Hours are optional; when present they must be a number ≥ 0 ("12,5" accepted). */
export const hoursValidator: ValidatorFn = decimalValidator('hours', (value) => value >= 0);

/** Date input validator: empty, or from 1970-01-01 to tomorrow (the API's bounds). */
export const runDateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  isWithinRunDateLimits(control.value as string | null) ? null : { runDate: true };

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

/**
 * Status after the user edits the end date: a date up to `today` on a run in progress or pending
 * finishes it (COMPLETADO); clearing the date of a completed run reopens it (EN_CURSO). A future end
 * date changes nothing, ABANDONADO is never changed, and any other combination keeps the status.
 * Dates are ISO `yyyy-mm-dd`, so they compare as text.
 */
export function statusForEndDate(
  status: ExperienceStatus,
  endDate: string | null | undefined,
  today: string,
): ExperienceStatus {
  if (endDate) {
    return (status === 'EN_CURSO' || status === 'PENDIENTE') && endDate <= today ? 'COMPLETADO' : status;
  }
  return status === 'COMPLETADO' ? 'EN_CURSO' : status;
}

/** ONLINE games are tracked through online playtime only: new runs are not offered for them. */
export function canStartRun(game: Pick<Game, 'category'>): boolean {
  return game.category !== 'ONLINE';
}

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
  /** Catalog platform id; required by the form validators before a request is built. */
  platformId: number | null;
  startDate: string;
  endDate: string;
  /** Raw text of the decimal inputs ("12,5"); parsed when building the request. */
  hours: string;
  rating: string;
  summary: string;
  platinum: boolean;
  fullCompletion: boolean;
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

/**
 * Maps the form value to the API request (empty strings become null, year is derived). The rating
 * is typed on `scale` and sent on the stored 0–10 scale.
 */
export function buildExperienceRequest(
  value: RunFormValue,
  original?: Pick<Experience, 'year' | 'startDate' | 'endDate'> | null,
  scale: RatingScale = '10',
): ExperienceRequest {
  const rating = numberOrNull(value.rating);
  const startDate = value.startDate || null;
  const endDate = value.endDate || null;
  return {
    runLabel: value.runLabel.trim(),
    year: deriveRunYear({ startDate, endDate }, original),
    status: value.status,
    rating: rating === null ? null : fromRatingScale(rating, scale),
    hours: numberOrNull(value.hours),
    startDate,
    endDate,
    platformId: value.platformId as number,
    platinum: value.platinum,
    fullCompletion: value.fullCompletion,
    replay: value.replay,
    summary: textOrNull(value.summary),
    pros: textOrNull(value.pros),
    cons: textOrNull(value.cons),
    notes: textOrNull(value.notes),
  };
}
