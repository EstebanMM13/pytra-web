import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Experience, ExperienceRequest, ExperienceStatus, Platform } from '../../../core/models/experience.model';

/** Pure helpers behind the run form: validation, defaults and request building. */

export const RUN_STATUSES: readonly ExperienceStatus[] = ['EN_CURSO', 'COMPLETADO', 'ABANDONADO', 'PENDIENTE'];
export const RUN_PLATFORMS: readonly Platform[] = ['PC', 'PS5', 'PS4', 'XBOX', 'SWITCH', 'MOBILE'];

/** Default label for a new run of a game that already has `existingRuns` runs. */
export function nextRunLabel(existingRuns: number): string {
  return `Run ${Math.max(0, existingRuns) + 1}`;
}

/** 0–10 with at most two decimals. Empty is valid (a run in progress has no rating yet). */
export function isValidRating(value: number | null | undefined): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (!Number.isFinite(value) || value < 0 || value > 10) {
    return false;
  }
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

export const ratingValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  isValidRating(control.value) ? null : { rating: true };

/** Hours are optional; when present they must be a finite number ≥ 0. */
export const hoursValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as number | null;
  return value === null || value === undefined || (Number.isFinite(value) && value >= 0)
    ? null
    : { hours: true };
};

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
  hours: number | null;
  rating: number | null;
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
    rating: value.rating ?? null,
    hours: value.hours ?? null,
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
