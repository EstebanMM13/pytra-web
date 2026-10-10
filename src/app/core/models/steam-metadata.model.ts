/** One hit of a Steam store search (GET /metadata/steam/search). */
export interface SteamStoreSearchResult {
  appId: number;
  name: string;
  /** Small capsule image from the Steam CDN; null when Steam has none. */
  imageUrl: string | null;
}

/** Steam store metadata normalized to the game form (GET /metadata/steam/{appId}). Nothing is saved. */
export interface SteamGameMetadata {
  steamAppId: number;
  name: string;
  developer: string | null;
  publisher: string | null;
  /** ISO date; null when unreleased or unparseable. */
  releaseDate: string | null;
  /** Steam genre names as the Spanish store shows them (e.g. "Acción"). */
  genres: string[];
  coverImageUrl: string | null;
}
