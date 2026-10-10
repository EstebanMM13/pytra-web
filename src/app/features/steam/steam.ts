import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideEyeOff, LucideLink, LucideRefreshCw } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Game } from '../../core/models/game.model';
import { SteamIgnoredApp, SteamPendingGame, SteamStatus, SteamSyncResult } from '../../core/models/steam.model';
import { AuthService } from '../../core/services/auth.service';
import { ExperienceService } from '../../core/services/experience.service';
import { NativeOAuthService } from '../../core/services/native-oauth.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { SteamService } from '../../core/services/steam.service';
import { Navbar } from '../../shared/navbar/navbar';
import { ToastService } from '../../shared/toast/toast.service';
import { SectionHeader } from '../../shared/ui/section-header';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { Skeleton } from '../../shared/ui/skeleton';
import { formatRelativeTime } from '../../shared/utils/relative-time';
import { SteamConfirmDialog, SteamConfirmMode } from './steam-confirm-dialog';
import {
  LINK_ERROR_KEYS,
  PendingChange,
  SYNC_ERROR_KEYS,
  apiCode,
  applyPendingChange,
  findSteamRun,
  lookup,
  maskSteamId,
  steamHours,
} from './steam.logic';

@Component({
  selector: 'app-steam',
  imports: [
    HoursPipe,
    TranslatePipe,
    Navbar,
    SectionHeader,
    Skeleton,
    SteamConfirmDialog,
    LucideEyeOff,
    LucideLink,
    LucideRefreshCw,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './steam.html',
})
export class Steam {
  private readonly steamService = inject(SteamService);
  private readonly experienceService = inject(ExperienceService);
  private readonly nativeOAuth = inject(NativeOAuthService);
  private readonly runFormLauncher = inject(RunFormLauncher);
  /** Read-only demo: no link, sync or unlink buttons (the API rejects them anyway). */
  protected readonly isDemo = inject(AuthService).isDemo;
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly status = signal<SteamStatus | null>(null);
  readonly statusLoading = signal(true);
  readonly pending = signal<SteamPendingGame[]>([]);
  readonly ignoredApps = signal<SteamIgnoredApp[]>([]);
  readonly loading = signal(true);
  readonly connecting = signal(false);
  readonly syncing = signal(false);
  readonly unlinking = signal(false);
  readonly confirmingUnlink = signal(false);
  readonly busyGameId = signal<number | null>(null);
  readonly syncResult = signal<SteamSyncResult | null>(null);
  readonly errorKey = signal<string | null>(null);
  readonly noticeKey = signal<string | null>(null);
  readonly showIgnored = signal(false);
  /** Pending game under review in the confirm dialog, and what happens after confirming. */
  readonly confirmTarget = signal<{ game: Game; mode: SteamConfirmMode } | null>(null);

  protected readonly maskedSteamId = computed(() => maskSteamId(this.status()?.steamId));
  protected readonly avatarInitial = computed(() => {
    const s = this.status();
    return (s?.personaName?.trim() || s?.steamId || '?').charAt(0).toUpperCase();
  });
  private readonly locale = computed(() => (this.translate.currentLang() === 'en' ? 'en-US' : 'es-ES'));
  protected readonly lastSyncRelative = computed(() => formatRelativeTime(this.status()?.lastSyncAt, this.locale()));

  /** Server counters (GET /status), falling back to the loaded lists if the API omits them. */
  protected readonly pendingTotal = computed(() => this.status()?.pendingCount ?? this.pending().length);
  protected readonly ignoredTotal = computed(() => this.status()?.ignoredCount ?? this.ignoredApps().length);
  protected readonly linkedGamesCount = computed(() => this.status()?.linkedGamesCount ?? null);

  protected readonly steamHours = steamHours;

  protected lastSession(game: SteamPendingGame): string | null {
    return formatRelativeTime(game.lastPlayedAt, this.locale());
  }

  /** Keeps the status counters in step with local list changes (no refetch needed). */
  private applyChange(change: PendingChange): void {
    this.status.update((status) => (status ? applyPendingChange(status, change) : status));
  }

  constructor() {
    this.readCallbackParams();
    this.loadStatus();
    this.loadPending();
    this.loadIgnored();
  }

  connect(): void {
    this.connecting.set(true);
    this.errorKey.set(null);
    this.steamService.requestConnectToken().subscribe({
      next: ({ token }) => {
        this.nativeOAuth.openExternalFlow(this.steamService.buildLoginUrl(token)).finally(() => {
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
        if (this.confirmTarget()?.game.id === game.id) this.confirmTarget.set(null);
        this.applyChange('ignored');
        this.loadIgnored();
      },
      error: (err: HttpErrorResponse) => {
        this.busyGameId.set(null);
        this.errorKey.set(
          apiCode(err) === 'SYNC_IN_PROGRESS' ? 'steam.errors.syncInProgress' : 'steam.errors.ignoreFailed',
        );
      },
    });
  }

  unignore(app: SteamIgnoredApp): void {
    this.steamService.unignore(app.appId).subscribe({
      next: () => {
        this.ignoredApps.update((list) => list.filter((a) => a.appId !== app.appId));
        this.applyChange('unignored');
        this.noticeKey.set('steam.unignored');
      },
      error: () => this.errorKey.set('steam.errors.generic'),
    });
  }

  openConfirm(game: Game, mode: SteamConfirmMode): void {
    this.errorKey.set(null);
    this.confirmTarget.set({ game, mode });
  }

  onConfirmed(game: Game): void {
    const mode = this.confirmTarget()?.mode ?? 'confirm';
    this.confirmTarget.set(null);
    if (this.pending().some((g) => g.id === game.id)) {
      this.applyChange('confirmed');
    }
    this.pending.update((list) => list.filter((g) => g.id !== game.id));
    this.toast.success(this.translate.instant('steam.confirmed', { name: game.name }));
    if (mode === 'run') {
      this.openRunFor(game);
    }
  }

  /**
   * Confirming a SINGLEPLAYER game makes the API create a run with the Steam hours, so we open that
   * run to complete it (status, rating…) instead of a new one that would count the hours twice.
   * ONLINE/HYBRID hours go to the game's online playtime: open a fresh PC run without hours.
   */
  private openRunFor(game: Game): void {
    if (game.category !== 'SINGLEPLAYER') {
      this.runFormLauncher.openNewRun(game.id, { platform: 'PC' });
      return;
    }
    this.experienceService.findAllByGame(game.id).subscribe({
      next: (runs) => {
        const steamRun = findSteamRun(runs);
        if (steamRun) {
          this.runFormLauncher.openEditRun(steamRun);
        } else {
          this.runFormLauncher.openNewRun(game.id, { platform: 'PC' });
        }
      },
      error: () => this.runFormLauncher.openNewRun(game.id, { platform: 'PC' }),
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
