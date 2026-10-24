import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { DEMO_READ_ONLY } from '../../core/services/demo-mode.service';

/** Translation key plus its interpolation params. */
export interface ApiErrorMessage {
  key: string;
  params?: Record<string, string>;
}

/** ApiError.message values (stable codes or fixed texts) the UI can explain. */
const MESSAGE_KEYS: Record<string, string> = {
  'Game already exists': 'errors.duplicateGame',
  'Saga already exists': 'errors.duplicateSaga',
  'Conflict with existing data': 'errors.conflict',
  'Year note was saved concurrently, retry': 'errors.concurrentEdit',
  PLATFORM_CATALOG_FULL: 'errors.platformCatalogFull',
  PLATFORM_RATE_LIMITED: 'errors.platformRateLimited',
  EXPORT_RATE_LIMITED: 'profile.export.rateLimited',
  INVALID_PLATFORM: 'errors.invalidPlatform',
  INVALID_YEAR: 'errors.invalidYear',
  ONLINE_GAME_RUN: 'game.onlineNoRuns',
  INVALID_DIARY_DATE: 'errors.invalidDiaryDate',
  DUPLICATE_DIARY_GAME: 'errors.duplicateDiaryGame',
  DIARY_RUN_REQUIRED: 'diary.editor.runRequiredToast',
  INVALID_DIARY_RUN: 'diary.editor.runRequiredToast',
};

/** Request fields whose validation error has a full translated sentence. */
const FIELD_KEYS: Record<string, string> = {
  name: 'errors.fields.name',
  releaseDate: 'errors.fields.releaseDate',
  category: 'errors.fields.category',
  runLabel: 'errors.fields.runLabel',
  status: 'errors.fields.status',
  rating: 'errors.fields.rating',
  hours: 'errors.fields.hours',
  totalHours: 'errors.fields.hours',
  generalRating: 'errors.fields.rating',
  startDate: 'errors.fields.runDates',
  endDate: 'errors.fields.runDates',
  year: 'errors.fields.runYear',
};

function own(map: Record<string, string>, key: string): string | null {
  return Object.hasOwn(map, key) ? map[key] : null;
}

/**
 * What to tell the user about a failed API call: the API's own reason when it gave one
 * (duplicate name, field validation, platform limits...), a network/server hint, else `fallbackKey`.
 * Null when the error was already explained elsewhere (demo read-only toast, 401 redirect to login).
 */
export function describeApiError(err: unknown, fallbackKey: string): ApiErrorMessage | null {
  if (!(err instanceof HttpErrorResponse)) {
    return { key: fallbackKey };
  }
  const body = (err.error ?? null) as { message?: unknown; fieldErrors?: unknown } | null;
  const message = typeof body?.message === 'string' ? body.message : '';

  if (err.status === 401 || (err.status === 403 && message === DEMO_READ_ONLY)) {
    return null;
  }
  if (err.status === 0) {
    return { key: 'errors.network' };
  }
  const known = own(MESSAGE_KEYS, message);
  if (known) {
    return { key: known };
  }
  const fieldErrors = body?.fieldErrors;
  if (err.status === 400 && fieldErrors && typeof fieldErrors === 'object') {
    const [field, detail] = Object.entries(fieldErrors as Record<string, unknown>)[0] ?? [];
    if (field) {
      const fieldKey = own(FIELD_KEYS, field);
      return fieldKey
        ? { key: fieldKey }
        : { key: 'errors.field', params: { field, message: typeof detail === 'string' ? detail : '' } };
    }
  }
  switch (err.status) {
    case 404:
      return { key: 'errors.notFound' };
    case 409:
      return { key: 'errors.conflict' };
    case 429:
      return { key: 'errors.tooManyRequests' };
  }
  return err.status >= 500 ? { key: 'errors.server' } : { key: fallbackKey };
}

/** `describeApiError` translated, ready for a toast; null when nothing should be shown. */
export function apiErrorText(err: unknown, translate: TranslateService, fallbackKey: string): string | null {
  const described = describeApiError(err, fallbackKey);
  return described ? (translate.instant(described.key, described.params) as string) : null;
}

/** Error toast for a failed API call (see `describeApiError`); shows nothing when already explained. */
export function toastApiError(
  toast: { error(message: string): void },
  translate: TranslateService,
  err: unknown,
  fallbackKey: string,
): void {
  const text = apiErrorText(err, translate, fallbackKey);
  if (text) toast.error(text);
}
