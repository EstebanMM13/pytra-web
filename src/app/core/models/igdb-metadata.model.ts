/** One hit of an IGDB search (GET /metadata/igdb/search). */
export interface IgdbSearchResult {
  igdbId: number;
  name: string;
  /** Year of the first release; null when IGDB has no date. */
  year: number | null;
  /** Small portrait cover from images.igdb.com; null when IGDB has none. */
  imageUrl: string | null;
  /** Short platform names ("PS5", "Switch", "PC"...). */
  platforms: string[];
}

/** IGDB metadata normalized to the game form (GET /metadata/igdb/{id}); same shape as Steam's plus platforms. */
export interface IgdbGameMetadata {
  igdbId: number;
  name: string;
  developer: string | null;
  publisher: string | null;
  /** ISO date; null when unknown or in the future. */
  releaseDate: string | null;
  /** IGDB genre names, in English (e.g. "Role-playing (RPG)"). */
  genres: string[];
  /** Landscape artwork when IGDB has one, the portrait cover otherwise. */
  coverImageUrl: string | null;
  platforms: string[];
}

/** Autofill sources this deployment offers (GET /metadata/providers). */
export interface MetadataProviders {
  igdb: boolean;
  steam: boolean;
}
