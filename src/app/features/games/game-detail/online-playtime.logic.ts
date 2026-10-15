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
  };
  if (draft.existing || draft.platformsTouched) {
    request.platformIds = [...draft.platformIds];
  }
  return request;
}
