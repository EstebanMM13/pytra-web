import { HttpErrorResponse } from '@angular/common/http';
import { Experience } from '../../core/models/experience.model';

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

/** Error key for a failed confirm: a running sync and a duplicate name both answer 409. */
export function confirmErrorKey(err: HttpErrorResponse): string {
  if (apiCode(err) === 'SYNC_IN_PROGRESS') {
    return 'steam.errors.syncInProgress';
  }
  return err.status === 409 ? 'steam.errors.duplicateName' : 'steam.errors.confirmFailed';
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
