import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS } from '../../../shared/ui/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Game } from '../../../core/models/game.model';
import { SteamIgnoredApp, SteamPendingGame, SteamStatus, SteamSyncResult } from '../../../core/models/steam.model';
import { DemoModeService } from '../../../core/services/demo-mode.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { NativeOAuthService } from '../../../core/services/native-oauth.service';
import { RunFormLauncher } from '../../../core/services/run-form-launcher.service';
import { SteamService } from '../../../core/services/steam.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { SectionHeader } from '../../../shared/ui/section-header';
import { HoursPipe } from '../../../shared/pipes/hours.pipe';
import { TranslatePluralPipe } from '../../../shared/pipes/translate-plural.pipe';
import { Skeleton } from '../../../shared/ui/skeleton';
import { GameCover } from '../../../shared/ui/game-cover';
import { PlatformCard } from '../../../shared/ui/platform-card';
import { BrandLogo } from '../shared/brand-logo';
import { formatRelativeTime } from '../../../shared/utils/relative-time';
import { GameEditDialog } from '../../games/game-edit-dialog/game-edit-dialog';
import { PendingConfirmFn, PendingConfirmMode } from '../shared/pending-review';
import { PendingChange, apiCode, applyPendingChange, lookup } from '../sync.logic';
import { LINK_ERROR_KEYS, SYNC_ERROR_KEYS, findSteamRun, maskSteamId, steamHours } from './steam.logic';

@Component({
  selector: 'app-steam-panel',
  imports: [
    HoursPipe,
    TranslatePipe,
    TranslatePluralPipe,
    SectionHeader,
    Skeleton,
    GameEditDialog,
    GameCover,
    LucideDynamicIcon,
    PlatformCard,
    BrandLogo,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './steam-panel.html',
  host: { class: 'flex flex-col gap-4 md:gap-6' },
})
/** Steam platform on the Sync page: link, sync, pending review and ignored apps. */
export class SteamPanel {
  protected readonly icons = ICONS;

  private readonly steamService = inject(SteamService);
  private readonly experienceService = inject(ExperienceService);
  private readonly nativeOAuth = inject(NativeOAuthService);
  private readonly runFormLauncher = inject(RunFormLauncher);
  /** Read-only demo: every action is shown, but each one stops at the demo toast (no inline error). */
  private readonly demoMode = inject(DemoModeService);
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
  readonly confirmTarget = signal<{ game: Game; mode: PendingConfirmMode } | null>(null);

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
  protected readonly confirmPending: PendingConfirmFn = (gameId, request) =>
    this.steamService.confirmPending(gameId, request);

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
    if (this.demoMode.blockWrite()) return;
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
    if (this.demoMode.blockWrite()) return;
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
    if (this.demoMode.blockWrite()) return;
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
    if (this.demoMode.blockWrite()) return;
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
    if (this.demoMode.blockWrite()) return;
    this.steamService.unignore(app.appId).subscribe({
      next: () => {
        this.ignoredApps.update((list) => list.filter((a) => a.appId !== app.appId));
        this.applyChange('unignored');
        this.noticeKey.set('steam.unignored');
      },
      error: () => this.errorKey.set('steam.errors.generic'),
    });
  }

  openConfirm(game: Game, mode: PendingConfirmMode): void {
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
   * HYBRID hours go to the game's online playtime: open a fresh PC run without hours, with a note that
   * hours logged in it move out of the online playtime (the API takes them out). ONLINE games
   * have no runs at all, so their page (with the online hours) is shown instead.
   */
  private openRunFor(game: Game): void {
    if (game.category === 'ONLINE') {
      this.toast.show(this.translate.instant('game.onlineNoRuns'), 'info');
      void this.router.navigate(['/games', game.id]);
      return;
    }
    if (game.category !== 'SINGLEPLAYER') {
      this.runFormLauncher.openNewRun(game.id, { platform: 'PC' }, 'runForm.importedHoursHint.steam');
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
