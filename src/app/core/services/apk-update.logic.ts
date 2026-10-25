/** GitHub API endpoint for the newest published release of the Android app. */
export const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/EstebanMM13/pytra-web/releases/latest';

/** Name of the APK asset the release workflow attaches to every release. */
export const APK_ASSET_NAME = 'pytra.apk';

/** localStorage key holding the "Later" choice: `<version>|<YYYY-MM-DD>`. */
export const UPDATE_SNOOZE_KEY = 'pytra.apkUpdate.snooze';

export interface LatestRelease {
  /** Version without the leading "v" (e.g. "1.0.5"). */
  version: string;
  apkUrl: string;
}

function versionParts(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, '')
    .split(/[-+]/)[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

/**
 * Semantic comparison of dotted versions ("v1.2.10" > "1.2.9"); a leading "v" and any pre-release
 * or build suffix are ignored, missing parts count as 0. Negative, zero or positive like a sort.
 */
export function compareVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** Reads the version and the APK asset URL from a GitHub "latest release" response, or null. */
export function parseLatestRelease(json: unknown): LatestRelease | null {
  const release = json as {
    tag_name?: unknown;
    assets?: { name?: unknown; browser_download_url?: unknown }[];
  } | null;
  if (!release || typeof release.tag_name !== 'string' || !Array.isArray(release.assets)) {
    return null;
  }
  const asset = release.assets.find((a) => a?.name === APK_ASSET_NAME);
  if (!asset || typeof asset.browser_download_url !== 'string') {
    return null;
  }
  return { version: release.tag_name.trim().replace(/^v/i, ''), apkUrl: asset.browser_download_url };
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function snoozeValue(version: string, today: Date): string {
  return `${version}|${dayKey(today)}`;
}

/** True when "Later" was chosen today for this same version. */
export function isSnoozed(stored: string | null, version: string, today: Date): boolean {
  return stored === snoozeValue(version, today);
}

/** Download progress as a whole percentage (0-100); 0 while the size is unknown. */
export function progressPercent(bytes: number, contentLength: number): number {
  if (!(contentLength > 0)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((bytes / contentLength) * 100)));
}
