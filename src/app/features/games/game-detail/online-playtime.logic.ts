import { OnlinePlaytime, OnlinePlaytimeRequest } from '../../../core/models/online-playtime.model';

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
  return request;
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
