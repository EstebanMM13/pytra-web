import { HttpErrorResponse } from '@angular/common/http';
import { Experience } from '../../core/models/experience.model';
import { SteamStatus } from '../../core/models/steam.model';

/** Run label the API gives the run it creates when a SINGLEPLAYER Steam game is confirmed. */
export const STEAM_RUN_LABEL = 'Importado de Steam';

/** API error code (ApiError.message) -> translation key. */
export const SYNC_ERROR_KEYS: Record<string, string> = {
  STEAM_NOT_CONFIGURED: 'steam.errors.notConfigured',
  STEAM_NOT_LINKED: 'steam.errors.notLinked',
  SYNC_IN_PROGRESS: 'steam.errors.syncInProgress',
  STEAM_LINK_CHANGED: 'steam.errors.linkChanged',
  STEAM_RATE_LIMITED: 'steam.errors.rateLimited',
  STEAM_UNAVAILABLE: 'steam.errors.unavailable',
  STEAM_API_KEY_REJECTED: 'steam.errors.apiKeyRejected',
};

/** `linkError` values set by /oauth-callback from the API's fixed redirect errors. */
export const LINK_ERROR_KEYS: Record<string, string> = {
  steam_link_failed: 'steam.errors.linkFailed',
  steam_account_already_linked: 'steam.errors.alreadyLinked',
  steam_sync_in_progress: 'steam.errors.linkSyncInProgress',
};

export function apiCode(err: HttpErrorResponse): string {
  const message = (err.error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : '';
}

/** Own-property lookup, so inputs like "constructor" never resolve to prototype members. */
export function lookup(map: Record<string, string>, key: string): string | null {
  return Object.hasOwn(map, key) ? map[key] : null;
}

/** Error key for a failed confirm: a running sync and a duplicate name both answer 409. */
export function confirmErrorKey(err: HttpErrorResponse): string {
  if (apiCode(err) === 'SYNC_IN_PROGRESS') {
    return 'steam.errors.syncInProgress';
  }
  return err.status === 409 ? 'steam.errors.duplicateName' : 'steam.errors.confirmFailed';
}

/** Masks all but the first 10 digits of a SteamID64: `7656119800•••••••`. */
export function maskSteamId(steamId: string | null | undefined): string {
  if (!steamId) {
    return '';
  }
  return steamId.length <= 10 ? steamId : `${steamId.slice(0, 10)}${'•'.repeat(steamId.length - 10)}`;
}

/**
 * The run that already holds a just-confirmed game's Steam hours (SINGLEPLAYER only): the one the
 * API labelled as imported, or the game's only run. Creating another run would count the hours twice.
 */
export function findSteamRun(runs: readonly Experience[]): Experience | null {
  return runs.find((r) => r.runLabel === STEAM_RUN_LABEL) ?? (runs.length === 1 ? runs[0] : null);
}

/** Local change to a pending game, mirrored in the status counters without refetching. */
export type PendingChange = 'ignored' | 'confirmed' | 'unignored';

/** Status counters after a pending game is ignored, confirmed or un-ignored (never below 0). */
export function applyPendingChange(status: SteamStatus, change: PendingChange): SteamStatus {
  const dec = (n: number) => Math.max(0, (n ?? 0) - 1);
  switch (change) {
    case 'ignored':
      return { ...status, pendingCount: dec(status.pendingCount), ignoredCount: (status.ignoredCount ?? 0) + 1 };
    case 'confirmed':
      return {
        ...status,
        pendingCount: dec(status.pendingCount),
        linkedGamesCount: (status.linkedGamesCount ?? 0) + 1,
      };
    case 'unignored':
      return { ...status, ignoredCount: dec(status.ignoredCount) };
  }
}

/** Steam playtime in hours (the API sends minutes). */
export function steamHours(minutes: number | null | undefined): number {
  return Math.max(0, minutes ?? 0) / 60;
}
