import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Game, GameRequest } from '../../../core/models/game.model';
import { psnConfirmErrorKey } from '../psn/psn.logic';
import { steamConfirmErrorKey } from '../steam/steam.logic';
import { SyncSource } from '../sync.logic';

/** `confirm`: only add the game to the library. `run`: the caller opens a run right after. */
export type PendingConfirmMode = 'confirm' | 'run';

/** Confirms a pending game on the integration that imported it (PUT /pending/{id}/confirm). */
export type PendingConfirmFn = (gameId: number, request: GameRequest) => Observable<Game>;

/**
 * Turns the game form into the review step of a game imported by Steam or PSN: copy comes from
 * the `<source>.confirmDialog.*` keys and saving confirms the game with `confirmWith`.
 */
export interface PendingReview {
  source: SyncSource;
  mode: PendingConfirmMode;
  confirmWith: PendingConfirmFn;
}

/** Each integration maps its own API codes (Steam and PSN messages differ). */
export function pendingConfirmErrorKey(source: SyncSource, err: HttpErrorResponse): string {
  return source === 'psn' ? psnConfirmErrorKey(err) : steamConfirmErrorKey(err);
}
