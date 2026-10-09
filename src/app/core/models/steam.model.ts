export interface SteamSyncResult {
  gamesScanned: number;
  newGamesPending: number;
  linkedExisting: number;
  gamesUpdated: number;
  ignored: number;
  skipped: number;
  errored: number;
  /** Steam hid the library (private profile or private game details); nothing was changed. */
  profilePrivate: boolean;
}

export interface SteamStatus {
  linked: boolean;
  steamId: string | null;
  personaName: string | null;
  lastSyncAt: string | null;
  /** False when the server has no Steam API key: linking works, syncing does not. */
  configured: boolean;
}

export interface SteamIgnoredApp {
  appId: string;
  name: string;
  ignoredAt: string;
}

/** Stable error codes the API returns in `ApiError.message` for Steam endpoints. */
export type SteamErrorCode =
  | 'STEAM_NOT_CONFIGURED'
  | 'STEAM_NOT_LINKED'
  | 'SYNC_IN_PROGRESS'
  | 'STEAM_LINK_CHANGED'
  | 'STEAM_API_KEY_REJECTED'
  | 'STEAM_RATE_LIMITED'
  | 'STEAM_UNAVAILABLE';
