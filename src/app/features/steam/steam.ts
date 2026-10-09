import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Game, GameCategory } from '../../core/models/game.model';
import { Genre } from '../../core/models/genre.model';
import { Saga } from '../../core/models/saga.model';
import { SteamIgnoredApp, SteamStatus, SteamSyncResult } from '../../core/models/steam.model';
import { GenreService } from '../../core/services/genre.service';
import { NativeOAuthService } from '../../core/services/native-oauth.service';
import { SagaService } from '../../core/services/saga.service';
import { SteamService } from '../../core/services/steam.service';
import { Navbar } from '../../shared/navbar/navbar';

/** API error code (ApiError.message) -> translation key. */
const SYNC_ERROR_KEYS: Record<string, string> = {
  STEAM_NOT_CONFIGURED: 'steam.errors.notConfigured',
  STEAM_NOT_LINKED: 'steam.errors.notLinked',
  SYNC_IN_PROGRESS: 'steam.errors.syncInProgress',
  STEAM_LINK_CHANGED: 'steam.errors.linkChanged',
  STEAM_RATE_LIMITED: 'steam.errors.rateLimited',
  STEAM_UNAVAILABLE: 'steam.errors.unavailable',
  STEAM_API_KEY_REJECTED: 'steam.errors.apiKeyRejected',
};

/** `linkError` values set by /oauth-callback from the API's fixed redirect errors. */
const LINK_ERROR_KEYS: Record<string, string> = {
  steam_link_failed: 'steam.errors.linkFailed',
  steam_account_already_linked: 'steam.errors.alreadyLinked',
  steam_sync_in_progress: 'steam.errors.linkSyncInProgress',
};

@Component({
  selector: 'app-steam',
  imports: [ReactiveFormsModule, Navbar, TranslatePipe, DatePipe],
  templateUrl: './steam.html',
})
export class Steam {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly steamService = inject(SteamService);
  private readonly nativeOAuth = inject(NativeOAuthService);
  private readonly sagaService = inject(SagaService);
  private readonly genreService = inject(GenreService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly categories: GameCategory[] = ['SINGLEPLAYER', 'ONLINE', 'HYBRID'];

  readonly status = signal<SteamStatus | null>(null);
  readonly statusLoading = signal(true);
  readonly pending = signal<Game[]>([]);
  readonly ignoredApps = signal<SteamIgnoredApp[]>([]);
  readonly sagas = signal<Saga[]>([]);
  readonly genres = signal<Genre[]>([]);
  readonly loading = signal(true);
  readonly connecting = signal(false);
  readonly syncing = signal(false);
  readonly unlinking = signal(false);
  readonly confirmingUnlink = signal(false);
  readonly busyGameId = signal<number | null>(null);
  readonly syncResult = signal<SteamSyncResult | null>(null);
  readonly errorKey = signal<string | null>(null);
  readonly noticeKey = signal<string | null>(null);

  readonly confirmingId = signal<number | null>(null);
  readonly selectedGenreIds = signal<Set<number>>(new Set());

  readonly confirmForm = this.fb.group({
    name: this.fb.control('', Validators.required),
    category: this.fb.control<GameCategory>('SINGLEPLAYER', Validators.required),
    sagaId: this.fb.control<number | null>(null),
  });

  constructor() {
    this.readCallbackParams();
    this.loadStatus();
    this.loadPending();
    this.loadIgnored();
    this.sagaService.findAll().subscribe((sagas) => this.sagas.set(sagas));
    this.genreService.findAll().subscribe((genres) => this.genres.set(genres));
  }

  connect(): void {
    this.connecting.set(true);
    this.errorKey.set(null);
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
        this.errorKey.set('steam.errors.connectFailed');
      },
    });
  }

  sync(): void {
    this.syncing.set(true);
    this.errorKey.set(null);
    this.noticeKey.set(null);
    this.syncResult.set(null);

    this.steamService.sync().subscribe({
      next: (result) => {
        this.syncing.set(false);
        this.syncResult.set(result);
        this.loadStatus();
        this.loadPending();
      },
      error: (err: HttpErrorResponse) => {
        this.syncing.set(false);
        this.errorKey.set(lookup(SYNC_ERROR_KEYS, apiCode(err)) ?? 'steam.errors.syncFailed');
      },
    });
  }

  askUnlink(): void {
    this.confirmingUnlink.set(true);
  }

  cancelUnlink(): void {
    this.confirmingUnlink.set(false);
  }

  unlink(): void {
    this.unlinking.set(true);
    this.errorKey.set(null);
    this.steamService.unlink().subscribe({
      next: () => {
        this.unlinking.set(false);
        this.confirmingUnlink.set(false);
        this.syncResult.set(null);
        this.noticeKey.set('steam.unlinked');
        this.loadStatus();
        this.loadPending();
        this.loadIgnored();
      },
      error: (err: HttpErrorResponse) => {
        this.unlinking.set(false);
        this.errorKey.set(lookup(SYNC_ERROR_KEYS, apiCode(err)) ?? 'steam.errors.unlinkFailed');
      },
    });
  }

  ignore(game: Game): void {
    this.busyGameId.set(game.id);
    this.errorKey.set(null);
    this.steamService.ignorePending(game.id).subscribe({
      next: () => {
        this.busyGameId.set(null);
        this.pending.update((list) => list.filter((g) => g.id !== game.id));
        if (this.confirmingId() === game.id) this.confirmingId.set(null);
        this.loadIgnored();
      },
      error: (err: HttpErrorResponse) => {
        this.busyGameId.set(null);
        this.errorKey.set(
          apiCode(err) === 'SYNC_IN_PROGRESS' ? 'steam.errors.syncInProgress' : 'steam.errors.ignoreFailed'
        );
      },
    });
  }

  unignore(app: SteamIgnoredApp): void {
    this.steamService.unignore(app.appId).subscribe({
      next: () => {
        this.ignoredApps.update((list) => list.filter((a) => a.appId !== app.appId));
        this.noticeKey.set('steam.unignored');
      },
      error: () => this.errorKey.set('steam.errors.generic'),
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
      // Both a running sync and a duplicate name answer 409: tell them apart by code.
      error: (err: HttpErrorResponse) =>
        this.errorKey.set(
          apiCode(err) === 'SYNC_IN_PROGRESS'
            ? 'steam.errors.syncInProgress'
            : err.status === 409
              ? 'steam.errors.duplicateName'
              : 'steam.errors.confirmFailed'
        ),
    });
  }

  private readCallbackParams(): void {
    const params = this.route.snapshot.queryParamMap;
    const linkError = params.get('linkError');
    if (linkError) {
      this.errorKey.set(lookup(LINK_ERROR_KEYS, linkError) ?? 'steam.errors.linkFailed');
    } else if (params.get('linked')) {
      this.noticeKey.set('steam.linked');
    }
    if (linkError || params.get('linked')) {
      // Drop the one-shot params so a reload doesn't show the message again.
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  private loadStatus(): void {
    this.steamService.getStatus().subscribe({
      next: (status) => {
        this.status.set(status);
        this.statusLoading.set(false);
      },
      error: () => {
        this.statusLoading.set(false);
        this.errorKey.set('steam.errors.generic');
      },
    });
  }

  private loadPending(): void {
    this.steamService.getPending().subscribe({
      next: (pending) => {
        this.pending.set(pending);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadIgnored(): void {
    this.steamService.getIgnored().subscribe({
      next: (apps) => this.ignoredApps.set(apps),
      error: () => this.ignoredApps.set([]),
    });
  }
}

function apiCode(err: HttpErrorResponse): string {
  const message = (err.error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : '';
}

/** Own-property lookup, so inputs like "constructor" never resolve to prototype members. */
function lookup(map: Record<string, string>, key: string): string | null {
  return Object.hasOwn(map, key) ? map[key] : null;
}
