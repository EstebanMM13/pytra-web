import { Game } from './game.model';

/** Console of a PSN title, as the catalog legacy code the imported run uses. */
export type PsnPlatform = 'PS5' | 'PS4';

export interface PsnSyncResult {
  gamesScanned: number;
  newGamesPending: number;
  linkedExisting: number;
  gamesUpdated: number;
  ignored: number;
  skipped: number;
  errored: number;
  /** PSN hid the game list (privacy settings); nothing was changed. */
  profilePrivate: boolean;
}

export interface PsnStatus {
  linked: boolean;
  accountId: string | null;
  onlineId: string | null;
  lastSyncAt: string | null;
  /** False when the server has no PSN service account: nothing PSN-related works. */
  configured: boolean;
  /** PSN titles already linked to a Pytra game. */
  linkedGamesCount: number;
  /** PSN games waiting for review (same list as GET /pending). */
  pendingCount: number;
  ignoredCount: number;
  /** Admins only: `PSN_SERVICE_AUTH_FAILED` while Sony rejects the service account; null otherwise. */
  serviceAuthError: string | null;
  serviceAuthFailingSince: string | null;
}

/**
 * Item of GET /integrations/psn/pending: a game pending review plus its PSN data. A game played on
 * PS4 and PS5 reports the PS5 title, the summed playtime and the latest session.
 * `lastPlayedAt` is an ISO instant, unlike the `yyyy-MM-dd` date of the same name on library games.
 */
export interface PsnPendingGame extends Game {
  titleId: string;
  psnPlatform: PsnPlatform;
  psnPlaytimeMinutes: number;
  lastPlayedAt: string | null;
}

export interface PsnIgnoredTitle {
  titleId: string;
  platform: PsnPlatform;
  name: string;
  ignoredAt: string;
}

/** Stable error codes the API returns in `ApiError.message` for PSN endpoints. */
export type PsnErrorCode =
  | 'PSN_INVALID_ONLINE_ID'
  | 'PSN_USER_NOT_FOUND'
  | 'PSN_PROFILE_PRIVATE'
  | 'PSN_NOT_LINKED'
  | 'SYNC_IN_PROGRESS'
  | 'PSN_LINK_CHANGED'
  | 'PSN_RATE_LIMITED'
  | 'PSN_NOT_CONFIGURED'
  | 'PSN_UNAVAILABLE';
