import { HttpErrorResponse } from '@angular/common/http';
import { Experience } from '../../../core/models/experience.model';
import { apiCode, findImportedRun, findImportedRuns, lookup, playtimeHours } from '../sync.logic';

/** Run label the API gives the run it creates when a SINGLEPLAYER PSN game is confirmed. */
export const PSN_RUN_LABEL = 'Importado de PlayStation';

/** PSN online IDs: 3-16 letters, digits, hyphens or underscores (same rule as the API). */
export const PSN_ONLINE_ID_PATTERN = /^[A-Za-z0-9_-]{3,16}$/;

/** The online ID as the API receives it (surrounding spaces dropped). */
export function normalizeOnlineId(raw: string | null | undefined): string {
  return (raw ?? '').trim();
}

export function isValidOnlineId(raw: string | null | undefined): boolean {
  return PSN_ONLINE_ID_PATTERN.test(normalizeOnlineId(raw));
}

/** API error code (ApiError.message) -> translation key. */
export const PSN_ERROR_KEYS: Record<string, string> = {
  PSN_INVALID_ONLINE_ID: 'psn.errors.invalidOnlineId',
  PSN_USER_NOT_FOUND: 'psn.errors.userNotFound',
  PSN_PROFILE_PRIVATE: 'psn.errors.profilePrivate',
  PSN_NOT_LINKED: 'psn.errors.notLinked',
  SYNC_IN_PROGRESS: 'psn.errors.syncInProgress',
  PSN_LINK_CHANGED: 'psn.errors.linkChanged',
  PSN_RATE_LIMITED: 'psn.errors.rateLimited',
  PSN_NOT_CONFIGURED: 'psn.errors.notConfigured',
  PSN_UNAVAILABLE: 'psn.errors.unavailable',
};

/** Translation key for a failed PSN call: the API code's message, else `fallback`. */
export function psnErrorKey(err: HttpErrorResponse, fallback: string): string {
  return lookup(PSN_ERROR_KEYS, apiCode(err)) ?? fallback;
}

/**
 * Error key for a failed PSN confirm: the PSN codes keep their message (a running sync, a link that
 * changed or a PSN outage); any other 409 is a duplicate name.
 */
export function psnConfirmErrorKey(err: HttpErrorResponse): string {
  const known = lookup(PSN_ERROR_KEYS, apiCode(err));
  if (known) {
    return known;
  }
  return err.status === 409 ? 'psn.errors.duplicateName' : 'psn.errors.confirmFailed';
}

/** Linking failed because the profile hides its game list: show the privacy steps. */
export function isProfilePrivate(err: HttpErrorResponse): boolean {
  return apiCode(err) === 'PSN_PROFILE_PRIVATE';
}

/** The run that already holds a just-confirmed PSN game's hours (see `findImportedRun`). */
export function findPsnRun(runs: readonly Experience[]): Experience | null {
  return findImportedRun(runs, PSN_RUN_LABEL);
}

/** Every run that holds a just-confirmed PSN game's hours, one per console (see `findImportedRuns`). */
export function findPsnRuns(runs: readonly Experience[]): Experience[] {
  return findImportedRuns(runs, PSN_RUN_LABEL);
}

/** PSN playtime in hours (the API sends minutes). */
export const psnHours = playtimeHours;
