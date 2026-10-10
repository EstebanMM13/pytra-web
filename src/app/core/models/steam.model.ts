import { Game } from './game.model';

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
  /** Steam games already linked to a Pytra game. */
  linkedGamesCount: number;
  /** Steam games waiting for review (same list as GET /pending). */
  pendingCount: number;
  ignoredCount: number;
}

/**
 * Item of GET /integrations/steam/pending: a game pending review plus its Steam data.
 * Note `lastPlayedAt` here is an ISO instant (last Steam session), unlike the `yyyy-MM-dd`
 * date of the same name on library games.
 */
export interface SteamPendingGame extends Game {
  appId: string;
  steamPlaytimeMinutes: number;
  lastPlayedAt: string | null;
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
