import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Experience } from '../models/experience.model';

/** Optional values to prefill a new run with (e.g. hours and platform from a Steam import). */
export interface RunPrefill {
  hours?: number | null;
  /** Platform key: catalog id, old enum value ("PC") or name; see `findPlatformByKey`. */
  platform?: string;
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
      /** Translation key of a note shown under the hours (e.g. how imported hours are counted). */
      hintKey?: string;
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
  /** Runs still to edit after the open one (see `openEditRuns`). */
  private pendingEdits: Experience[] = [];

  readonly request = this.requestState.asReadonly();
  readonly saved$: Observable<RunSaved> = this.savedSubject.asObservable();

  // The read-only demo opens the form too (to explore it); its save is stopped by ModalSheet.
  openNewRun(gameId?: number, prefill?: RunPrefill, hintKey?: string): void {
    this.pendingEdits = [];
    this.requestState.set({
      mode: 'create',
      gameId,
      prefill,
      navigateOnCreate: gameId === undefined,
      hintKey,
    });
  }

  openEditRun(experience: Experience): void {
    this.pendingEdits = [];
    this.requestState.set({ mode: 'edit', experience });
  }

  /**
   * Opens the edit form for each run in turn (e.g. every run a platform import created for a game):
   * the next one opens when the current one is saved or closed. Any other open request drops the rest.
   */
  openEditRuns(experiences: readonly Experience[]): void {
    const [first, ...rest] = experiences;
    if (!first) return;
    this.openEditRun(first);
    this.pendingEdits = rest;
  }

  /** Closes the form, or moves on to the next run queued by `openEditRuns`. */
  close(): void {
    this.requestState.set(this.nextRequest());
  }

  /**
   * Called by the form after a successful save (and after it invalidated `UserDataCache`, kept out
   * of this service so the app root does not pull the cache into the initial bundle); closes the
   * form and notifies listeners.
   */
  notifySaved(saved: RunSaved): void {
    this.requestState.set(this.nextRequest());
    this.savedSubject.next(saved);
  }

  private nextRequest(): RunFormRequest | null {
    const next = this.pendingEdits.shift();
    return next ? { mode: 'edit', experience: next } : null;
  }
}
