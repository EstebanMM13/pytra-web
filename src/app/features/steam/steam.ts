import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Game, GameCategory } from '../../core/models/game.model';
import { Genre } from '../../core/models/genre.model';
import { Saga } from '../../core/models/saga.model';
import { SteamSyncResult } from '../../core/models/steam.model';
import { GenreService } from '../../core/services/genre.service';
import { SagaService } from '../../core/services/saga.service';
import { SteamService } from '../../core/services/steam.service';
import { NativeOAuthService } from '../../core/services/native-oauth.service';
import { Navbar } from '../../shared/navbar/navbar';

@Component({
  selector: 'app-steam',
  imports: [ReactiveFormsModule, Navbar],
  templateUrl: './steam.html',
})
export class Steam {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly steamService = inject(SteamService);
  private readonly nativeOAuth = inject(NativeOAuthService);
  private readonly sagaService = inject(SagaService);
  private readonly genreService = inject(GenreService);

  readonly categories: GameCategory[] = ['SINGLEPLAYER', 'ONLINE', 'HYBRID'];

  readonly pending = signal<Game[]>([]);
  readonly sagas = signal<Saga[]>([]);
  readonly genres = signal<Genre[]>([]);
  readonly loading = signal(true);
  readonly connecting = signal(false);
  readonly syncing = signal(false);
  readonly syncResult = signal<SteamSyncResult | null>(null);
  readonly error = signal<string | null>(null);

  readonly confirmingId = signal<number | null>(null);
  readonly selectedGenreIds = signal<Set<number>>(new Set());

  readonly confirmForm = this.fb.group({
    name: this.fb.control('', Validators.required),
    category: this.fb.control<GameCategory>('SINGLEPLAYER', Validators.required),
    sagaId: this.fb.control<number | null>(null),
  });

  constructor() {
    this.steamService.getPending().subscribe({
      next: (pending) => {
        this.pending.set(pending);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.sagaService.findAll().subscribe((sagas) => this.sagas.set(sagas));
    this.genreService.findAll().subscribe((genres) => this.genres.set(genres));
  }

  connect(): void {
    this.connecting.set(true);
    this.steamService.requestConnectToken().subscribe({
      next: ({ token }) => {
        this.nativeOAuth
          .openExternalFlow(this.steamService.buildLoginUrl(token))
          .finally(() => {
            // On native the app stays alive behind the Custom Tab; let the user retry.
            if (this.nativeOAuth.isNative) this.connecting.set(false);
          });
      },
      error: () => {
        this.connecting.set(false);
        this.error.set('No se pudo iniciar la conexión con Steam.');
      },
    });
  }

  sync(): void {
    this.syncing.set(true);
    this.error.set(null);

    this.steamService.sync().subscribe({
      next: (result) => {
        this.syncing.set(false);
        this.syncResult.set(result);
        this.steamService.getPending().subscribe((pending) => this.pending.set(pending));
      },
      error: (err) => {
        this.syncing.set(false);
        this.error.set(
          err.status === 404 ? 'Primero conecta tu cuenta de Steam.' : 'No se pudo sincronizar.'
        );
      },
    });
  }

  openConfirmForm(game: Game): void {
    this.confirmingId.set(game.id);
    this.confirmForm.setValue({
      name: game.name,
      category: game.category ?? 'SINGLEPLAYER',
      sagaId: game.sagaId,
    });
    this.selectedGenreIds.set(new Set(game.genres.map((g) => g.id)));
  }

  cancelConfirm(): void {
    this.confirmingId.set(null);
  }

  toggleGenre(genreId: number): void {
    this.selectedGenreIds.update((current) => {
      const next = new Set(current);
      next.has(genreId) ? next.delete(genreId) : next.add(genreId);
      return next;
    });
  }

  confirm(): void {
    if (this.confirmForm.invalid) {
      this.confirmForm.markAllAsTouched();
      return;
    }

    const id = this.confirmingId();
    if (!id) return;

    const request = {
      ...this.confirmForm.getRawValue(),
      genreIds: [...this.selectedGenreIds()],
    };

    this.steamService.confirmPending(id, request).subscribe({
      next: () => {
        this.pending.update((list) => list.filter((g) => g.id !== id));
        this.confirmingId.set(null);
      },
      error: () => this.error.set('No se pudo confirmar el juego.'),
    });
  }
}
