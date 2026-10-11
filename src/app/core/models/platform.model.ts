/** Hardware family of a catalog platform, used to group the picker and to pick a default color. */
export type PlatformFamily = 'PLAYSTATION' | 'XBOX' | 'NINTENDO' | 'PC' | 'MOBILE' | 'OTHER';

export const PLATFORM_FAMILIES: readonly PlatformFamily[] = ['PC', 'PLAYSTATION', 'XBOX', 'NINTENDO', 'MOBILE', 'OTHER'];

/**
 * Value of the old fixed platform enum. The API still accepts and returns it for clients built before
 * the catalog existed (`OTHER` for catalog entries the enum did not have).
 */
export type LegacyPlatformCode = 'PC' | 'PS5' | 'PS4' | 'XBOX' | 'SWITCH' | 'MOBILE' | 'OTHER';

/** An entry of the global platform catalog (`GET /platforms`). */
export interface Platform {
  id: number;
  name: string;
  /** `#RRGGBB`; null only for entries without color and family. */
  color: string | null;
  family: PlatformFamily | null;
  /** Old enum value for the six entries that replaced it, else null. */
  legacyCode: LegacyPlatformCode | null;
  sortOrder: number;
}

/** Compact platform reference embedded in other responses (e.g. a game's platforms). */
export interface PlatformRef {
  id: number;
  name: string;
  color: string | null;
}

export interface PlatformRequest {
  name: string;
  family?: PlatformFamily | null;
  color?: string | null;
}

export const PLATFORM_NAME_MAX_LENGTH = 40;
