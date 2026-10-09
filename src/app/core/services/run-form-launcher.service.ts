import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Single entry point for "+ Partida" (web navbar) and the central "+" (mobile tab bar).
 *
 * PHASE 2 HOOK: replace the body of `openNewRun` with opening the run form
 * (modal on web, full-screen sheet on mobile). Until then it routes to the existing
 * creation flow: the game detail page (when a game is known) or the games list.
 */
@Injectable({ providedIn: 'root' })
export class RunFormLauncher {
  private readonly router = inject(Router);

  openNewRun(gameId?: number): void {
    this.router.navigate(gameId === undefined ? ['/games'] : ['/games', gameId]);
  }
}
