import { Experience } from '../../../core/models/experience.model';
import { findImportedRun, playtimeHours } from '../sync.logic';

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

/** Masks all but the first 10 digits of a SteamID64: `7656119800•••••••`. */
export function maskSteamId(steamId: string | null | undefined): string {
  if (!steamId) {
    return '';
  }
  return steamId.length <= 10
    ? steamId
    : `${steamId.slice(0, 10)}${'•'.repeat(steamId.length - 10)}`;
}

/** The run that already holds a just-confirmed Steam game's hours (see `findImportedRun`). */
export function findSteamRun(runs: readonly Experience[]): Experience | null {
  return findImportedRun(runs, STEAM_RUN_LABEL);
}

/** Steam playtime in hours (the API sends minutes). */
export const steamHours = playtimeHours;
