import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Experience, Platform } from '../models/experience.model';

/** Optional values to prefill a new run with (e.g. hours and platform from a Steam import). */
export interface RunPrefill {
  hours?: number | null;
  platform?: Platform;
}

/** What the run form is currently open for. Rendered by `RunFormHost` (app root). */
export type RunFormRequest =
  | {
      mode: 'create';
      /** Preselected (and locked) game; absent when opened from the global "+" buttons. */
      gameId?: number;
      prefill?: RunPrefill;
      /** Opened from a global entry point: navigate to the new run after saving. */
      navigateOnCreate: boolean;
    }
  | { mode: 'edit'; experience: Experience };

export interface RunSaved {
  experience: Experience;
  created: boolean;
}

/**
 * Single entry point to the run form (modal on web, full-screen sheet on mobile):
 * navbar "+ Partida", mobile "+", game detail "+ Nueva partida" and "Editar partida".
 * Views listen to `saved$` to refresh themselves.
 */
@Injectable({ providedIn: 'root' })
export class RunFormLauncher {
  private readonly requestState = signal<RunFormRequest | null>(null);
  private readonly savedSubject = new Subject<RunSaved>();

  readonly request = this.requestState.asReadonly();
  readonly saved$: Observable<RunSaved> = this.savedSubject.asObservable();

  openNewRun(gameId?: number, prefill?: RunPrefill): void {
    this.requestState.set({ mode: 'create', gameId, prefill, navigateOnCreate: gameId === undefined });
  }

  openEditRun(experience: Experience): void {
    this.requestState.set({ mode: 'edit', experience });
  }

  close(): void {
    this.requestState.set(null);
  }

  /** Called by the form after a successful save; closes it and notifies listeners. */
  notifySaved(saved: RunSaved): void {
    this.requestState.set(null);
    this.savedSubject.next(saved);
  }
}
