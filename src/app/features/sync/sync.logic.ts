import { HttpErrorResponse } from '@angular/common/http';
import { EnrichmentProgress } from '../../core/models/enrichment.model';
import { Experience } from '../../core/models/experience.model';

export type { EnrichmentProgress };

/** Platform integrations on the Sync page that import games for review. */
export type SyncSource = 'steam' | 'psn';

export function apiCode(err: HttpErrorResponse): string {
  const message = (err.error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : '';
}

/** Own-property lookup, so inputs like "constructor" never resolve to prototype members. */
export function lookup(map: Record<string, string>, key: string): string | null {
  return Object.hasOwn(map, key) ? map[key] : null;
}

/**
 * The run that already holds a just-confirmed game's imported hours (SINGLEPLAYER only): the one
 * the API labelled `runLabel`, or the game's only run. Creating another run would count the hours twice.
 */
export function findImportedRun(runs: readonly Experience[], runLabel: string): Experience | null {
  return runs.find((r) => r.runLabel === runLabel) ?? (runs.length === 1 ? runs[0] : null);
}

/** Local change to a pending game, mirrored in the status counters without refetching. */
export type PendingChange = 'ignored' | 'confirmed' | 'unignored';

/** Status counters every sync integration reports. */
export interface PendingCounters {
  linkedGamesCount: number;
  pendingCount: number;
  ignoredCount: number;
}

/** Status counters after a pending game is ignored, confirmed or un-ignored (never below 0). */
export function applyPendingChange<S extends PendingCounters>(status: S, change: PendingChange): S {
  const dec = (n: number) => Math.max(0, (n ?? 0) - 1);
  switch (change) {
    case 'ignored':
      return {
        ...status,
        pendingCount: dec(status.pendingCount),
        ignoredCount: (status.ignoredCount ?? 0) + 1,
      };
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

/** Playtime in hours (the integrations send minutes). */
export function playtimeHours(minutes: number | null | undefined): number {
  return Math.max(0, minutes ?? 0) / 60;
}

/** Time between two refreshes of the pending list while IGDB fills it. */
export const ENRICHMENT_POLL_INTERVAL_MS = 2500;
/** Polling gives up after this long, even if the API still reports the fill as active. */
export const ENRICHMENT_POLL_MAX_MS = 3 * 60 * 1000;

/** Keep refreshing while the fill is active and the time cap is not reached. */
export function shouldKeepPolling(progress: EnrichmentProgress | null | undefined, elapsedMs: number): boolean {
  return !!progress?.active && elapsedMs < ENRICHMENT_POLL_MAX_MS;
}

/**
 * Pending list after a background refresh: the server's rows, in the server's order, minus the ones
 * the user confirmed or ignored here meanwhile (a refresh sent before that change would bring them back).
 */
export function mergePending<T extends { id: number }>(fresh: readonly T[], removedIds: ReadonlySet<number>): T[] {
  return fresh.filter((game) => !removedIds.has(game.id));
}

/** Translation params of the "filling from IGDB" indicator; null while the fill has no count yet. */
export function enrichmentCount(progress: EnrichmentProgress | null | undefined): { processed: number; total: number } | null {
  if (!progress?.active || !(progress.total > 0)) return null;
  return { processed: Math.min(progress.processed, progress.total), total: progress.total };
}
