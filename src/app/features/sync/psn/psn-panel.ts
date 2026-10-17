import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Game } from '../../../core/models/game.model';
import {
  PsnIgnoredTitle,
  PsnPendingGame,
  PsnPlatform,
  PsnStatus,
  PsnSyncResult,
} from '../../../core/models/psn.model';
import { DemoModeService } from '../../../core/services/demo-mode.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { PsnService } from '../../../core/services/psn.service';
import { RunFormLauncher } from '../../../core/services/run-form-launcher.service';
import { HoursPipe } from '../../../shared/pipes/hours.pipe';
import { TranslatePluralPipe } from '../../../shared/pipes/translate-plural.pipe';
import { ToastService } from '../../../shared/toast/toast.service';
import { GameCover } from '../../../shared/ui/game-cover';
import { ICONS } from '../../../shared/ui/icons';
import { PlatformCard } from '../../../shared/ui/platform-card';
import { SectionHeader } from '../../../shared/ui/section-header';
import { Skeleton } from '../../../shared/ui/skeleton';
import { formatRelativeTime } from '../../../shared/utils/relative-time';
import { PendingConfirmDialog, PendingConfirmFn, PendingConfirmMode } from '../shared/pending-confirm-dialog';
import { PendingChange, applyPendingChange } from '../sync.logic';
import { findPsnRun, isProfilePrivate, isValidOnlineId, normalizeOnlineId, psnErrorKey, psnHours } from './psn.logic';

/** Banner shown when GET /status fails. */
const STATUS_ERROR_KEY = 'psn.errors.generic';

/**
 * PlayStation platform on the Sync page: link by online ID, sync, pending review and ignored
 * titles. Mirrors `SteamPanel`; PSN has no OAuth, the user types their public online ID.
 */
@Component({
  selector: 'app-psn-panel',
  imports: [
    HoursPipe,
    TranslatePipe,
    TranslatePluralPipe,
    SectionHeader,
    Skeleton,
    PendingConfirmDialog,
    GameCover,
    LucideDynamicIcon,
    PlatformCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './psn-panel.html',
  host: { class: 'flex flex-col gap-4 md:gap-6' },
})
export class PsnPanel {
  protected readonly icons = ICONS;

  private readonly psnService = inject(PsnService);
  private readonly experienceService = inject(ExperienceService);
  private readonly runFormLauncher = inject(RunFormLauncher);
  /** Read-only demo: every action is shown, but each one stops at the demo toast (no inline error). */
  private readonly demoMode = inject(DemoModeService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly status = signal<PsnStatus | null>(null);
  readonly statusLoading = signal(true);
  readonly pending = signal<PsnPendingGame[]>([]);
  readonly ignoredTitles = signal<PsnIgnoredTitle[]>([]);
  readonly loading = signal(true);
  readonly onlineId = signal('');
  /** The link form was submitted with an invalid online ID (checked before calling the API). */
  readonly onlineIdInvalid = signal(false);
  readonly linking = signal(false);
  readonly syncing = signal(false);
  readonly unlinking = signal(false);
  readonly confirmingUnlink = signal(false);
  readonly busyGameId = signal<number | null>(null);
  readonly syncResult = signal<PsnSyncResult | null>(null);
  readonly errorKey = signal<string | null>(null);
  readonly noticeKey = signal<string | null>(null);
  /** PSN answered PROFILE_PRIVATE when linking: the privacy steps are shown prominently. */
  readonly linkPrivate = signal(false);
  readonly showIgnored = signal(false);
  /** Pending game under review in the confirm dialog, and what happens after confirming. */
  readonly confirmTarget = signal<{ game: PsnPendingGame; mode: PendingConfirmMode } | null>(null);

  /** Header badge: unavailable (server not configured), linked or not linked. */
  protected readonly badge = computed(() => {
    const s = this.status();
    if (!s) return null;
    if (!s.configured) return { key: 'psn.unavailablePill', cls: 'bg-gold-tint text-gold-tint-fg' };
    return s.linked
      ? { key: 'psn.linkedPill', cls: 'bg-success-bg text-success' }
      : { key: 'psn.notLinkedPill', cls: 'bg-neutral-bg text-neutral' };
  });
  protected readonly avatarInitial = computed(() =>
    (this.status()?.onlineId?.trim() || '?').charAt(0).toUpperCase(),
  );
  private readonly locale = computed(() => (this.translate.currentLang() === 'en' ? 'en-US' : 'es-ES'));
  protected readonly lastSyncRelative = computed(() =>
    formatRelativeTime(this.status()?.lastSyncAt, this.locale()),
  );
  protected readonly serviceAuthSince = computed(() =>
    formatRelativeTime(this.status()?.serviceAuthFailingSince, this.locale()),
  );

  /** Server counters (GET /status), falling back to the loaded lists if the API omits them. */
  protected readonly pendingTotal = computed(() => this.status()?.pendingCount ?? this.pending().length);
  protected readonly ignoredTotal = computed(
    () => this.status()?.ignoredCount ?? this.ignoredTitles().length,
  );
  protected readonly linkedGamesCount = computed(() => this.status()?.linkedGamesCount ?? null);
  /** The privacy steps, shown big after a private-profile answer (link or sync). */
  protected readonly showPrivacyHelp = computed(
    () => this.linkPrivate() || !!this.syncResult()?.profilePrivate,
  );

  protected readonly psnHours = psnHours;
  protected readonly confirmPending: PendingConfirmFn = (gameId, request) =>
    this.psnService.confirmPending(gameId, request);

  constructor() {
    this.loadStatus();
    this.loadPending();
    this.loadIgnored();
  }

  protected lastSession(game: PsnPendingGame): string | null {
    return formatRelativeTime(game.lastPlayedAt, this.locale());
  }

  /** Keeps the status counters in step with local list changes (no refetch needed). */
  private applyChange(change: PendingChange): void {
    this.status.update((status) => (status ? applyPendingChange(status, change) : status));
  }

  onOnlineIdInput(value: string): void {
    this.onlineId.set(value);
    this.onlineIdInvalid.set(false);
  }

  link(): void {
    if (this.demoMode.blockWrite()) return;
    if (!isValidOnlineId(this.onlineId())) {
      this.onlineIdInvalid.set(true);
      return;
    }
    this.linking.set(true);
    this.errorKey.set(null);
    this.noticeKey.set(null);
    this.linkPrivate.set(false);
    this.psnService.link(normalizeOnlineId(this.onlineId())).subscribe({
      next: (status) => {
        this.linking.set(false);
        this.status.set(status);
        this.onlineId.set('');
        this.noticeKey.set('psn.linked');
        this.loadPending();
        this.loadIgnored();
      },
      error: (err: HttpErrorResponse) => {
        this.linking.set(false);
        if (isProfilePrivate(err)) {
          this.linkPrivate.set(true);
          return;
        }
        this.errorKey.set(psnErrorKey(err, 'psn.errors.linkFailed'));
      },
    });
  }

  sync(): void {
    if (this.demoMode.blockWrite()) return;
    this.syncing.set(true);
    this.errorKey.set(null);
    this.noticeKey.set(null);
    this.linkPrivate.set(false);
    this.syncResult.set(null);

    this.psnService.sync().subscribe({
      next: (result) => {
        this.syncing.set(false);
        this.syncResult.set(result);
        this.loadStatus();
        this.loadPending();
      },
      error: (err: HttpErrorResponse) => {
        this.syncing.set(false);
        this.errorKey.set(psnErrorKey(err, 'psn.errors.syncFailed'));
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
    this.psnService.unlink().subscribe({
      next: () => {
        this.unlinking.set(false);
        this.confirmingUnlink.set(false);
        this.syncResult.set(null);
        this.noticeKey.set('psn.unlinked');
        this.loadStatus();
        this.loadPending();
        this.loadIgnored();
      },
      error: (err: HttpErrorResponse) => {
        this.unlinking.set(false);
        this.errorKey.set(psnErrorKey(err, 'psn.errors.unlinkFailed'));
      },
    });
  }

  ignore(game: PsnPendingGame): void {
    if (this.demoMode.blockWrite()) return;
    this.busyGameId.set(game.id);
    this.errorKey.set(null);
    this.psnService.ignorePending(game.id).subscribe({
      next: () => {
        this.busyGameId.set(null);
        this.pending.update((list) => list.filter((g) => g.id !== game.id));
        if (this.confirmTarget()?.game.id === game.id) this.confirmTarget.set(null);
        this.applyChange('ignored');
        this.loadIgnored();
      },
      error: (err: HttpErrorResponse) => {
        this.busyGameId.set(null);
        this.errorKey.set(psnErrorKey(err, 'psn.errors.ignoreFailed'));
      },
    });
  }

  unignore(title: PsnIgnoredTitle): void {
    if (this.demoMode.blockWrite()) return;
    this.psnService.unignore(title.titleId).subscribe({
      next: () => {
        this.ignoredTitles.update((list) => list.filter((t) => t.titleId !== title.titleId));
        this.applyChange('unignored');
        this.noticeKey.set('psn.unignored');
      },
      error: () => this.errorKey.set('psn.errors.generic'),
    });
  }

  openConfirm(game: PsnPendingGame, mode: PendingConfirmMode): void {
    this.errorKey.set(null);
    this.confirmTarget.set({ game, mode });
  }

  onConfirmed(game: Game): void {
    const target = this.confirmTarget();
    this.confirmTarget.set(null);
    if (this.pending().some((g) => g.id === game.id)) {
      this.applyChange('confirmed');
    }
    this.pending.update((list) => list.filter((g) => g.id !== game.id));
    this.toast.success(this.translate.instant('psn.confirmed', { name: game.name }));
    if (target?.mode === 'run') {
      this.openRunFor(game, target.game.psnPlatform ?? 'PS5');
    }
  }

  /**
   * Same rules as Steam: confirming a SINGLEPLAYER game makes the API create a run with the PSN
   * hours on the title's console, so that run is opened to complete it. HYBRID hours go to the
   * game's online playtime: open a fresh run on that console. ONLINE games have no runs: show the game.
   */
  private openRunFor(game: Game, platform: PsnPlatform): void {
    if (game.category === 'ONLINE') {
      void this.router.navigate(['/games', game.id]);
      return;
    }
    if (game.category !== 'SINGLEPLAYER') {
      this.runFormLauncher.openNewRun(game.id, { platform });
      return;
    }
    this.experienceService.findAllByGame(game.id).subscribe({
      next: (runs) => {
        const psnRun = findPsnRun(runs);
        if (psnRun) {
          this.runFormLauncher.openEditRun(psnRun);
        } else {
          this.runFormLauncher.openNewRun(game.id, { platform });
        }
      },
      error: () => this.runFormLauncher.openNewRun(game.id, { platform }),
    });
  }

  private loadStatus(): void {
    this.psnService.getStatus().subscribe({
      next: (status) => {
        this.status.set(status);
        this.statusLoading.set(false);
        // A later successful load clears the banner a failed one left behind.
        if (this.errorKey() === STATUS_ERROR_KEY) this.errorKey.set(null);
      },
      error: () => {
        this.statusLoading.set(false);
        this.errorKey.set(STATUS_ERROR_KEY);
      },
    });
  }

  private loadPending(): void {
    this.psnService.getPending().subscribe({
      next: (pending) => {
        this.pending.set(pending);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadIgnored(): void {
    this.psnService.getIgnored().subscribe({
      next: (titles) => this.ignoredTitles.set(titles),
      error: () => this.ignoredTitles.set([]),
    });
  }
}
