import { OnlinePlaytime, OnlinePlaytimeRequest } from '../../../core/models/online-playtime.model';
import { formatHoursInput, parseDecimal } from '../../../shared/utils/decimal-input';

/** Load state of a game's online playtime card. */
export type OnlinePlaytimeLoadState = 'loading' | 'loaded' | 'missing' | 'error';

/** Load state for a failed `GET online-playtime`: 404 just means nothing is recorded yet. */
export function onlinePlaytimeErrorState(error: unknown): OnlinePlaytimeLoadState {
  return (error as { status?: number } | null)?.status === 404 ? 'missing' : 'error';
}

export interface OnlinePlaytimeDraft {
  totalHours: number;
  generalRating: number | null;
  /** The stored record, when there is one (its untouched fields are kept). */
  existing: OnlinePlaytime | null;
  platformIds: number[];
  /** Whether the user changed the platform picker since the card loaded. */
  platformsTouched: boolean;
  /** The card's platinum / 100% switches (the stored flags, or pending ones before the first save). */
  platinum: boolean;
  fullCompletion: boolean;
  /** Hours per platform id to save; omitted keeps the stored breakdown. */
  platformHours?: Record<number, number>;
}

/**
 * PUT body for the online card. Fields the card does not edit are echoed back. Without a stored
 * record and an untouched picker, `platformIds` is left out so the API keeps whatever it has.
 */
export function buildOnlinePlaytimeRequest(draft: OnlinePlaytimeDraft): OnlinePlaytimeRequest {
  const request: OnlinePlaytimeRequest = {
    totalHours: draft.totalHours,
    generalRating: draft.generalRating,
    lastSessionAt: draft.existing?.lastSessionAt ?? null,
    notes: draft.existing?.notes ?? null,
    platinum: draft.platinum,
    fullCompletion: draft.fullCompletion,
  };
  if (draft.existing || draft.platformsTouched) {
    request.platformIds = [...draft.platformIds];
  }
  if (draft.platformHours) {
    request.platformHours = { ...draft.platformHours };
  }
  return request;
}

/** Text of the online card's per-platform hour inputs, by platform id. */
export type PlatformHoursInputs = Record<number, string>;

/** Inputs for the picked platforms from the stored breakdown (blank where nothing is assigned). */
export function platformHoursInputsOf(
  playtime: OnlinePlaytime | null,
  platformIds: number[],
  lang: string,
): PlatformHoursInputs {
  const stored = playtime?.platformHours ?? {};
  return Object.fromEntries(platformIds.map((id) => [id, formatHoursInput(stored[String(id)], lang)]));
}

export interface PlatformHoursSplit {
  /** Hours per platform id; blank inputs are left out (unassigned). */
  hours: Record<number, number>;
  assigned: number;
  /** What is left of the total for no platform in particular (never negative). */
  unassigned: number;
  /** How far the split goes above the total (0 when it fits). */
  over: number;
  error: 'invalid' | 'exceedsTotal' | null;
}

/** Tolerance for decimal sums like 0,1 + 0,2 (the API uses the same). */
const HOURS_TOLERANCE = 1e-6;

/**
 * Parses the inputs of the picked platforms against the total: unparsable or negative hours are
 * `invalid`, a split adding up to more than the total is `exceedsTotal`.
 */
export function parsePlatformHours(
  inputs: PlatformHoursInputs,
  platformIds: number[],
  totalHours: number,
): PlatformHoursSplit {
  const hours: Record<number, number> = {};
  let invalid = false;
  for (const id of platformIds) {
    const text = (inputs[id] ?? '').trim();
    if (!text) continue;
    const value = parseDecimal(text);
    if (value === null || Number.isNaN(value) || value < 0) {
      invalid = true;
      continue;
    }
    hours[id] = value;
  }
  const assigned = Object.values(hours).reduce((sum, h) => sum + h, 0);
  const error = invalid ? 'invalid' : assigned - totalHours > HOURS_TOLERANCE ? 'exceedsTotal' : null;
  return { hours, assigned, unassigned: Math.max(0, totalHours - assigned), over: Math.max(0, assigned - totalHours), error };
}

/** The online playtime's flags, as the card shows them (absent from older API versions means false). */
export interface OnlineFlags {
  platinum: boolean;
  fullCompletion: boolean;
}

export function onlineFlagsOf(playtime: OnlinePlaytime | null): OnlineFlags {
  return { platinum: !!playtime?.platinum, fullCompletion: !!playtime?.fullCompletion };
}

/**
 * Confetti after a save that *reaches* the platinum or the 100% (like a run's): re-saving an already
 * flagged playtime stays quiet, and the read-only demo never celebrates.
 */
export function shouldCelebrateOnline(saved: OnlineFlags, previous: OnlineFlags, demo: boolean): boolean {
  if (demo) {
    return false;
  }
  return (saved.platinum && !previous.platinum) || (saved.fullCompletion && !previous.fullCompletion);
}

/** Stored online hours on no platform: the total minus the per-platform hours (never negative). */
export function unassignedHoursOf(playtime: OnlinePlaytime | null): number {
  if (!playtime) return 0;
  const assigned = Object.values(playtime.platformHours ?? {}).reduce((sum, h) => sum + h, 0);
  return Math.max(0, playtime.totalHours - assigned);
}

/** The stored total once the platforms not in `keptIds` (and their hours) are removed. */
export function totalWithout(playtime: OnlinePlaytime, keptIds: number[]): number {
  const kept = new Set(keptIds.map(String));
  const removed = Object.entries(playtime.platformHours ?? {})
    .filter(([id]) => !kept.has(id))
    .reduce((sum, [, h]) => sum + h, 0);
  return Math.max(0, playtime.totalHours - removed);
}
