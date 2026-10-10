import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideChevronDown, LucideChevronRight, LucideDownload, LucideGamepad2, LucideUser } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';
import { GameService } from '../../core/services/game.service';
import { SagaService } from '../../core/services/saga.service';
import { StatsService } from '../../core/services/stats.service';
import { AchievementBadge } from '../../shared/achievements/achievement-badge';
import { Achievement, computeAchievements, groupByCategory, topUnlocked } from '../../shared/achievements/achievements';
import { Platform } from '../../core/models/experience.model';
import { SteamStatus } from '../../core/models/steam.model';
import { ExportFormat } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { InstallPromptService } from '../../core/services/install-prompt.service';
import { FileExportService, filenameFromContentDisposition } from '../../core/services/file-export.service';
import {
  Language,
  PLATFORMS,
  PreferencesService,
  RatingPrecision,
  applyLanguage,
} from '../../core/services/preferences.service';
import { SteamService } from '../../core/services/steam.service';
import { ThemePreference, ThemeService } from '../../core/services/theme.service';
import { UserService } from '../../core/services/user.service';
import { usernameValidators } from '../../core/validators/username';
import { Navbar } from '../../shared/navbar/navbar';
import { ToastService } from '../../shared/toast/toast.service';
import { SectionHeader } from '../../shared/ui/section-header';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented';
import { Skeleton } from '../../shared/ui/skeleton';
import { DeleteAccountDialog } from './delete-account-dialog';
import { avatarInitial, exportErrorKey, formatMemberSince } from './profile.logic';

type ProfileSection = 'account' | 'achievements' | 'preferences' | 'data';
type AchievementFilter = 'all' | 'unlocked' | 'locked';

const FEATURED_ACHIEVEMENTS = 6;

const EXPORT_FALLBACK_NAME: Record<ExportFormat, string> = {
  csv: 'pytra-export.csv',
  markdown: 'pytra-export.md',
};

@Component({
  selector: 'app-profile',
  imports: [
    Navbar,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    SectionHeader,
    Segmented,
    Skeleton,
    DeleteAccountDialog,
    AchievementBadge,
    LucideUser,
    LucideGamepad2,
    LucideDownload,
    LucideChevronRight,
    LucideChevronDown,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.html',
})
export class Profile {
  // The account card (rename / password) is hidden while the app is shared with demo
  // accounts, so testers can't change the shared credentials. Flip to re-enable it.
  protected readonly showAccountSection = false;
  // Same reason: testers know the shared password, so account deletion is hidden too.
  protected readonly showDeleteAccount = false;
  protected readonly sections = (['account', 'achievements', 'preferences', 'data'] as const).filter(
    (s) => s !== 'account' || this.showAccountSection,
  );

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly steamService = inject(SteamService);
  private readonly fileExport = inject(FileExportService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly theme = inject(ThemeService);
  protected readonly preferences = inject(PreferencesService);
  protected readonly installPrompt = inject(InstallPromptService);

  protected readonly themeOptions: SegmentedOption<ThemePreference>[] = [
    { value: 'dark', label: 'theme.dark' },
    { value: 'light', label: 'theme.light' },
    { value: 'system', label: 'theme.system' },
  ];
  protected readonly precisionOptions: SegmentedOption<RatingPrecision>[] = [
    { value: 'integer', label: '9' },
    { value: 'half', label: '9.5' },
    { value: 'hundredths', label: '9.25' },
  ];
  protected readonly languageOptions: SegmentedOption<Language>[] = [
    { value: 'es', label: 'language.es' },
    { value: 'en', label: 'language.en' },
  ];
  protected readonly platforms = PLATFORMS;

  protected readonly user = this.userService.currentUser;
  protected readonly displayName = this.userService.displayName;
  protected readonly initial = computed(() => avatarInitial(this.displayName()));
  protected readonly memberSince = computed(() =>
    formatMemberSince(this.user()?.createdAt, this.translate.currentLang() === 'en' ? 'en' : 'es'),
  );

  /** Steam link state for the mobile list; null while loading or unavailable. */
  protected readonly steamStatus = signal<SteamStatus | null>(null);

  protected readonly activeSection = signal<ProfileSection>('achievements');

  /** All badges in definition order (category, easier first); `null` while loading, `[]` when the data could not load. */
  protected readonly achievements = signal<Achievement[] | null>(null);
  protected readonly unlockedCount = computed(() => (this.achievements() ?? []).filter((a) => a.unlocked).length);
  protected readonly unlockedPercent = computed(() => {
    const total = this.achievements()?.length ?? 0;
    return total ? Math.round((this.unlockedCount() / total) * 100) : 0;
  });
  /** Collapsed view: the most impressive unlocked badges. */
  protected readonly featuredAchievements = computed(() => topUnlocked(this.achievements() ?? [], FEATURED_ACHIEVEMENTS));
  protected readonly showAllAchievements = signal(false);
  protected readonly achievementFilter = signal<AchievementFilter>('all');
  protected readonly achievementFilterOptions: SegmentedOption<AchievementFilter>[] = [
    { value: 'all', label: 'achievements.filter.all' },
    { value: 'unlocked', label: 'achievements.filter.unlocked' },
    { value: 'locked', label: 'achievements.filter.locked' },
  ];
  /** Expanded view: filtered badges grouped by category with per-group unlocked counts. */
  protected readonly achievementGroups = computed(() => {
    const filter = this.achievementFilter();
    const list = (this.achievements() ?? []).filter((a) => filter === 'all' || a.unlocked === (filter === 'unlocked'));
    return groupByCategory(list).map((g) => ({ ...g, unlocked: g.items.filter((a) => a.unlocked).length }));
  });
  /** Below md the expanded list uses compact two-column badges. */
  protected readonly isMobile = signal(typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches);

  protected setLanguage(language: Language): void {
    this.preferences.setLanguage(language);
    applyLanguage(this.translate, language);
  }

  readonly form = this.fb.group({
    username: this.fb.control('', usernameValidators),
  });
  protected readonly editingName = signal(false);
  readonly submitting = signal(false);
  readonly errorKey = signal<string | null>(null);

  protected readonly exporting = signal<ExportFormat | null>(null);
  protected readonly deleteOpen = signal(false);

  constructor() {
    if (typeof matchMedia === 'function') {
      const mq = matchMedia('(max-width: 767px)');
      const onChange = (e: MediaQueryListEvent) => this.isMobile.set(e.matches);
      mq.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));
    }

    forkJoin({
      games: inject(GameService).findAll(),
      sagas: inject(SagaService).findAll(),
      summary: inject(StatsService).getSummary(),
      years: inject(StatsService).getByYear().pipe(catchError(() => of([]))),
    })
      .pipe(catchError(() => of(null)))
      .subscribe((data) => {
        this.achievements.set(data ? computeAchievements(data) : []);
        // "Ver todos" on the dashboard links here with #profile-achievements; the card only
        // exists once this data is loaded, so scroll to it now instead of relying on the router.
        if (this.route.snapshot.fragment === 'profile-achievements') {
          setTimeout(() => this.scrollTo('achievements'));
        }
      });

    this.steamService
      .getStatus()
      .pipe(catchError(() => of(null)))
      .subscribe((status) => this.steamStatus.set(status));

    // Back from a Google re-login started by the delete dialog: reopen it to retry.
    if (this.route.snapshot.queryParamMap.get('delete') === '1') {
      this.deleteOpen.set(true);
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }

    // Prefill once the profile is available (it loads asynchronously after the token is read).
    effect(() => {
      const user = this.user();
      const control = this.form.controls.username;
      if (user && !control.dirty) {
        control.setValue(user.usernameDisplay || user.username);
      }
    });
  }

  protected scrollTo(section: ProfileSection): void {
    this.activeSection.set(section);
    document.getElementById(`profile-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected startEditName(): void {
    const user = this.user();
    this.form.reset({ username: user ? user.usernameDisplay || user.username : '' });
    this.errorKey.set(null);
    this.editingName.set(true);
  }

  protected cancelEditName(): void {
    this.editingName.set(false);
    this.errorKey.set(null);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);

    this.userService.updateUsername(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.submitting.set(false);
        this.editingName.set(false);
        this.form.reset({ username: user.usernameDisplay || user.username });
        this.toast.success(this.translate.instant('profile.saved'));
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorKey.set(err.status === 409 ? 'profile.usernameTaken' : 'auth.errors.generic');
      },
    });
  }

  protected setPlatform(value: string): void {
    if ((PLATFORMS as readonly string[]).includes(value)) {
      this.preferences.setDefaultPlatform(value as Platform);
    }
  }

  protected exportData(format: ExportFormat): void {
    if (this.exporting()) {
      return;
    }
    this.exporting.set(format);
    this.userService.exportData(format).subscribe({
      next: async (response) => {
        try {
          const filename = filenameFromContentDisposition(
            response.headers.get('Content-Disposition'),
            EXPORT_FALLBACK_NAME[format],
          );
          await this.fileExport.save(response.body ?? new Blob(), filename, this.translate.instant('profile.export.shareTitle'));
          this.toast.success(this.translate.instant('profile.export.done'));
        } catch {
          this.toast.error(this.translate.instant('profile.export.error'));
        } finally {
          this.exporting.set(null);
        }
      },
      error: (err) => {
        this.exporting.set(null);
        this.toast.error(this.translate.instant(exportErrorKey(err)));
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
