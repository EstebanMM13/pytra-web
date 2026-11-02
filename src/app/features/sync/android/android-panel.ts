import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { Game } from '../../../core/models/game.model';
import { AndroidUsageService } from '../../../core/services/android-usage.service';
import { AndroidUsageSyncService, syncWindow } from '../../../core/services/android-usage-sync.service';
import { DemoModeService } from '../../../core/services/demo-mode.service';
import { GameService } from '../../../core/services/game.service';
import { LaunchableApp, USAGE_TIME_ZONE, UsageStatsService } from '../../../core/services/usage-stats.service';
import { HoursPipe } from '../../../shared/pipes/hours.pipe';
import { ICONS } from '../../../shared/ui/icons';
import { Combobox, ComboboxOption } from '../../../shared/ui/combobox';
import { PlatformCard } from '../../../shared/ui/platform-card';
import { formatRelativeTime } from '../../../shared/utils/relative-time';
import { ToastService } from '../../../shared/toast/toast.service';

/** One installed app in the list, with the game it is linked to (null when unlinked). */
export interface AppRow extends LaunchableApp {
  gameId: number | null;
}

/** Games first, then the rest; linked apps always show, even with "only games". */
export function visibleApps(apps: LaunchableApp[], links: Map<string, number>, showAll: boolean): AppRow[] {
  return apps
    .filter((app) => showAll || app.isGame || links.has(app.packageName))
    .map((app) => ({ ...app, gameId: links.get(app.packageName) ?? null }))
    .sort((a, b) => Number(b.isGame) - Number(a.isGame) || a.label.localeCompare(b.label));
}

/**
 * Android play time on the Sync page (Android app only): the usage access permission, which installed app
 * is which game of the library, and "Sync now". The sync itself runs in AndroidUsageSyncService (also on
 * launch and on every return to the foreground).
 */
@Component({
  selector: 'app-android-panel',
  imports: [TranslatePipe, LucideDynamicIcon, PlatformCard, Combobox, HoursPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './android-panel.html',
  host: { class: 'contents' },
})
export class AndroidPanel {
  protected readonly icons = ICONS;

  private readonly usageStats = inject(UsageStatsService);
  private readonly api = inject(AndroidUsageService);
  private readonly gameService = inject(GameService);
  protected readonly syncService = inject(AndroidUsageSyncService);
  private readonly demoMode = inject(DemoModeService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  /** Null while checking; false hides the panel (web, iOS, an APK without the plugin). */
  readonly available = signal<boolean | null>(null);
  readonly hasPermission = signal(false);
  readonly apps = signal<LaunchableApp[]>([]);
  readonly links = signal<Map<string, number>>(new Map());
  readonly games = signal<Game[]>([]);
  readonly showAll = signal(false);
  /** Packages with a link change in flight. */
  readonly busy = signal<ReadonlySet<string>>(new Set());
  readonly errorKey = signal<string | null>(null);
  readonly confirmingReset = signal(false);
  readonly resetting = signal(false);
  /** Foreground minutes the phone reports per linked package over the last 7 days (what a sync sends). */
  readonly weekMinutes = signal<ReadonlyMap<string, number>>(new Map());

  readonly rows = computed(() => visibleApps(this.apps(), this.links(), this.showAll()));
  /** Library games for the picker, by name. */
  readonly gameOptions = computed<ComboboxOption[]>(() =>
    [...this.games()].sort((a, b) => a.name.localeCompare(b.name)).map((game) => ({ id: game.id, label: game.name })),
  );
  readonly linkedCount = computed(() => this.links().size);
  private readonly locale = computed(() => (this.translate.currentLang() === 'en' ? 'en-US' : 'es-ES'));
  /** "hace 5 minutos" / "5 minutes ago"; null before the first sync. */
  readonly lastSync = computed(() =>
    formatRelativeTime(this.syncService.lastSyncAt()?.toISOString(), this.locale()),
  );

  constructor() {
    void this.load();
    // Back from the usage access settings (or any return to the app): the permission may have changed.
    effect(() => {
      if (this.syncService.resumed() > 0) {
        untracked(() => void this.refreshPermission().then(() => this.loadUsage()));
      }
    });
  }

  async load(): Promise<void> {
    const available = await this.usageStats.isAvailable();
    this.available.set(available);
    if (!available) return;
    await this.refreshPermission();
    try {
      const [apps, links] = await Promise.all([
        this.usageStats.listLaunchableApps(),
        firstValueFrom(this.api.getLinks()),
      ]);
      this.apps.set(apps);
      this.links.set(new Map(links.map((link) => [link.packageName, link.gameId])));
    } catch {
      this.errorKey.set('androidUsage.errors.load');
    }
    void this.loadUsage();
    this.gameService.findAll().subscribe({ next: (games) => this.games.set(games) });
  }

  async refreshPermission(): Promise<void> {
    this.hasPermission.set(await this.usageStats.hasPermission());
  }

  /** Reads the last 7 days of the linked packages from the phone. Never throws (it is only shown). */
  async loadUsage(): Promise<void> {
    const packages = [...this.links().keys()];
    if (!this.hasPermission() || packages.length === 0) {
      this.weekMinutes.set(new Map());
      return;
    }
    try {
      const { from, to } = syncWindow(new Date(), USAGE_TIME_ZONE);
      const days = await this.usageStats.getDailyUsage(from, to, packages);
      const totals = new Map<string, number>();
      for (const day of days) totals.set(day.packageName, (totals.get(day.packageName) ?? 0) + day.minutes);
      this.weekMinutes.set(totals);
    } catch {
      this.weekMinutes.set(new Map());
    }
  }

  async grantPermission(): Promise<void> {
    await this.usageStats.openPermissionSettings();
  }

  /** Links `packageName` to `gameId` (null unlinks), replacing its previous game. */
  async changeLink(packageName: string, gameId: number | null): Promise<void> {
    if (this.demoMode.blockWrite()) return;
    const current = this.links().get(packageName) ?? null;
    if (gameId === current) return;
    this.errorKey.set(null);
    this.setBusy(packageName, true);
    try {
      if (current !== null) {
        await firstValueFrom(this.api.unlink(packageName));
        this.updateLinks((links) => links.delete(packageName));
      }
      if (gameId !== null) {
        await firstValueFrom(this.api.link(packageName, gameId));
        this.updateLinks((links) => links.set(packageName, gameId));
        void this.loadUsage();
      }
    } catch (error: unknown) {
      const status = (error as { status?: number } | null)?.status;
      this.errorKey.set(status === 409 ? 'androidUsage.errors.gameTaken' : 'androidUsage.errors.link');
      // Back to what the server has.
      const links = await firstValueFrom(this.api.getLinks()).catch(() => null);
      if (links) this.links.set(new Map(links.map((link) => [link.packageName, link.gameId])));
    } finally {
      this.setBusy(packageName, false);
    }
  }

  async syncNow(): Promise<void> {
    if (this.demoMode.blockWrite()) return;
    this.errorKey.set(null);
    try {
      const result = await this.syncService.syncNow();
      if (result) {
        this.toast.success(this.translate.instant('androidUsage.synced', { count: result.recorded }));
      }
    } catch {
      this.errorKey.set('androidUsage.errors.sync');
    }
  }

  /** Takes back everything Android added, then syncs again from scratch. */
  async resetAndResync(): Promise<void> {
    if (this.demoMode.blockWrite()) return;
    this.confirmingReset.set(false);
    this.errorKey.set(null);
    this.resetting.set(true);
    try {
      await firstValueFrom(this.api.reset());
      const result = await this.syncService.syncNow();
      this.toast.success(this.translate.instant('androidUsage.resetDone', { count: result?.recorded ?? 0 }));
    } catch {
      this.errorKey.set('androidUsage.errors.reset');
    } finally {
      this.resetting.set(false);
    }
  }

  isBusy(packageName: string): boolean {
    return this.busy().has(packageName);
  }

  private updateLinks(change: (links: Map<string, number>) => void): void {
    this.links.update((links) => {
      const next = new Map(links);
      change(next);
      return next;
    });
  }

  private setBusy(packageName: string, busy: boolean): void {
    this.busy.update((set) => {
      const next = new Set(set);
      if (busy) next.add(packageName);
      else next.delete(packageName);
      return next;
    });
  }
}
