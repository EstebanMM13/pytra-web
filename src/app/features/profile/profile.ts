import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { ICONS } from '../../shared/ui/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, combineLatest, of } from 'rxjs';
import { GameService } from '../../core/services/game.service';
import { SagaService } from '../../core/services/saga.service';
import { StatsService } from '../../core/services/stats.service';
import { AchievementBadge } from '../../shared/achievements/achievement-badge';
import { Achievement, computeAchievements, groupByCategory, topUnlocked } from '../../shared/achievements/achievements';
import { findPlatformByKey, groupPlatformsByFamily, platformNameKey } from '../../core/services/platform.logic';
import { PlatformService } from '../../core/services/platform.service';
import { ExportFormat } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { DemoModeService } from '../../core/services/demo-mode.service';
import { InstallPromptService } from '../../core/services/install-prompt.service';
import { AndroidAppService } from '../../core/services/android-app.service';
import { DiaryReminderService, ReminderResult, parseReminderTime } from '../../core/services/diary-reminder.service';
import { FileExportService, filenameFromContentDisposition } from '../../core/services/file-export.service';
import {
  Language,
  PreferencesService,
  RatingPrecision,
  applyLanguage,
} from '../../core/services/preferences.service';
import { ThemePreference, ThemeService } from '../../core/services/theme.service';
import { RatingScale } from '../../shared/utils/rating-scale';
import { UserService } from '../../core/services/user.service';
import { usernameValidators } from '../../core/validators/username';
import { Navbar } from '../../shared/navbar/navbar';
import { ToastService } from '../../shared/toast/toast.service';
import { SectionHeader } from '../../shared/ui/section-header';
import { Avatar } from '../../shared/ui/avatar';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented';
import { MotionPreference } from '../../shared/utils/motion';
import { Skeleton } from '../../shared/ui/skeleton';
import { AccessTokens } from './access-tokens';
import { AvatarPicker } from './avatar-picker';
import { DeleteAccountDialog } from './delete-account-dialog';
import { ModalSheet } from '../../shared/ui/modal-sheet';
import {
  PROFILE_SECTIONS,
  PROFILE_SECTION_PARAM,
  ProfileSection,
  avatarErrorKey,
  exportErrorKey,
  formatMemberSince,
  initialProfileSection,
} from './profile.logic';

/**
 * A row of the mobile section list: scrolls to a section on this page, opens another route or logs
 * out. Same entries and order as the desktop sidebar (sections, Sync, log out).
 */
export type ProfileRow =
  | { kind: 'anchor'; anchor: ProfileSection; labelKey: string; icon: LucideIconInput }
  | { kind: 'route'; route: string; labelKey: string; icon: LucideIconInput }
  | { kind: 'logout'; labelKey: string; icon: LucideIconInput };

const SECTION_ICONS: Record<ProfileSection, LucideIconInput> = {
  account: ICONS.user,
  achievements: ICONS.trophy,
  preferences: ICONS.slidersHorizontal,
  data: ICONS.download,
};

const MOBILE_ROWS: readonly ProfileRow[] = [
  ...PROFILE_SECTIONS.map(
    (section): ProfileRow => ({
      kind: 'anchor',
      anchor: section,
      labelKey: `profile.sections.${section}`,
      icon: SECTION_ICONS[section],
    }),
  ),
  { kind: 'route', route: '/sync', labelKey: 'nav.sync', icon: ICONS.refreshCw },
  { kind: 'logout', labelKey: 'nav.logout', icon: ICONS.logOut },
];
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
    Avatar,
    AvatarPicker,
    DeleteAccountDialog,
    ModalSheet,
    AchievementBadge,
    LucideDynamicIcon,
    AccessTokens,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.html',
})
export class Profile {
  protected readonly icons = ICONS;

  // Read-only demo: every section is shown; its writes (and the export) stop at the demo toast.
  private readonly demoMode = inject(DemoModeService);
  protected readonly isDemo = this.demoMode.isDemo;
  /** Web sidebar entries. */
  protected readonly sections = PROFILE_SECTIONS;
  /** Phones and tablets: every section (plus Sync) as tappable rows at the top. */
  protected readonly mobileRows = MOBILE_ROWS;

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly fileExport = inject(FileExportService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly theme = inject(ThemeService);
  protected readonly preferences = inject(PreferencesService);
  protected readonly installPrompt = inject(InstallPromptService);
  protected readonly androidApp = inject(AndroidAppService);
  /** Daily diary reminder: Android app only. */
  protected readonly reminder = inject(DiaryReminderService);
  protected readonly reminderBusy = signal(false);

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
  protected readonly scaleOptions: SegmentedOption<RatingScale>[] = [
    { value: '10', label: '0–10' },
    { value: '100', label: '0–100' },
    { value: '5', label: '0–5' },
  ];
  protected readonly motionOptions: SegmentedOption<MotionPreference>[] = [
    { value: 'system', label: 'motion.system' },
    { value: 'full', label: 'motion.full' },
    { value: 'reduce', label: 'motion.reduce' },
  ];
  protected readonly languageOptions: SegmentedOption<Language>[] = [
    { value: 'es', label: 'language.es' },
    { value: 'en', label: 'language.en' },
  ];
  private readonly platformService = inject(PlatformService);
  protected readonly platformGroups = computed(() => groupPlatformsByFamily(this.platformService.platforms() ?? []));
  /** Translation key for seeded names that have one, else the name itself (renders as-is). */
  protected readonly platformLabel = (name: string): string => platformNameKey(name) ?? name;
  /** Catalog id of the default platform preference (stored as id or old enum value). */
  protected readonly defaultPlatformId = computed(
    () => findPlatformByKey(this.platformService.platforms() ?? [], this.preferences.defaultPlatform())?.id ?? null,
  );

  protected readonly user = this.userService.currentUser;
  protected readonly displayName = this.userService.displayName;
  protected readonly memberSince = computed(() =>
    formatMemberSince(this.user()?.createdAt, this.translate.currentLang() === 'en' ? 'en' : 'es'),
  );


  /** Highlighted sidebar entry: the targeted section on arrival (the top, "Cuenta", by default). */
  protected readonly activeSection = signal<ProfileSection>('account');
  /** Section the URL targets (`?section=`), scrolled to once the achievements are in (they set the page height). */
  private targetSection: ProfileSection = 'account';

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
    if (this.reminder.available && this.preferences.diaryReminder()) {
      // Reschedule once the new language is loaded, so the notification text follows it.
      this.translate.use(language).subscribe({
        next: () => void this.reminder.apply(true, this.preferences.diaryReminderTime()),
        error: () => {},
      });
    }
  }

  protected async toggleReminder(): Promise<void> {
    if (this.reminderBusy()) return;
    const enable = !this.preferences.diaryReminder();
    this.reminderBusy.set(true);
    const result = await this.reminder.apply(enable, this.preferences.diaryReminderTime());
    this.reminderBusy.set(false);
    this.afterReminderChange(result, enable);
  }

  protected async setReminderTime(time: string): Promise<void> {
    if (!parseReminderTime(time) || time === this.preferences.diaryReminderTime()) return;
    const enabled = this.preferences.diaryReminder();
    this.preferences.setDiaryReminder(enabled, time);
    if (!enabled) return;
    this.reminderBusy.set(true);
    const result = await this.reminder.apply(true, time);
    this.reminderBusy.set(false);
    this.afterReminderChange(result, true);
  }

  private afterReminderChange(result: ReminderResult, enable: boolean): void {
    if (result === 'scheduled' || result === 'cancelled') {
      this.preferences.setDiaryReminder(enable);
      if (enable) this.toast.success(this.translate.instant('profile.reminder.scheduled', { time: this.preferences.diaryReminderTime() }));
      return;
    }
    // Refused or failed: nothing is scheduled, so the switch shows off.
    this.preferences.setDiaryReminder(false);
    this.toast.error(this.translate.instant(result === 'denied' ? 'profile.reminder.denied' : 'profile.reminder.failed'));
  }

  readonly form = this.fb.group({
    username: this.fb.control('', usernameValidators),
  });
  protected readonly editingName = signal(false);
  readonly submitting = signal(false);
  readonly errorKey = signal<string | null>(null);

  protected readonly savingAvatar = signal(false);
  /** The avatar picker sheet, opened from the "Avatar" row of the account section. */
  protected readonly avatarOpen = signal(false);

  protected readonly exporting = signal<ExportFormat | null>(null);
  protected readonly deleteOpen = signal(false);

  constructor() {
    if (typeof matchMedia === 'function') {
      const mq = matchMedia('(max-width: 767px)');
      const onChange = (e: MediaQueryListEvent) => this.isMobile.set(e.matches);
      mq.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));
    }

    this.platformService.load().subscribe({ error: () => {} });

    // Back from a Google re-login started by the delete dialog: reopen it to retry. Read before the
    // section subscription so the cleanup navigation below keeps "Datos" highlighted.
    if (this.route.snapshot.queryParamMap.get('delete') === '1') {
      this.deleteOpen.set(true);
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }

    // Opens at the top unless an entry point targets a section (dashboard "Ver todos":
    // ?section=achievements). Also runs when the page is reused, e.g. the avatar menu from here.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.targetSection = this.deleteOpen() ? 'data' : initialProfileSection(params.get(PROFILE_SECTION_PARAM));
      this.activeSection.set(this.targetSection);
      if (this.achievements() !== null) {
        this.scrollToTarget();
      }
    });

    // combineLatest, not forkJoin: the cached lists render at once, a fresher emission recomputes.
    combineLatest({
      games: inject(GameService).findAll(),
      sagas: inject(SagaService).findAll(),
      summary: inject(StatsService).getSummary(),
      years: inject(StatsService).getByYear().pipe(catchError(() => of([]))),
    })
      .pipe(catchError(() => of(null)))
      .subscribe((data) => {
        this.achievements.set(data ? computeAchievements(data) : []);
        this.scrollToTarget();
      });

    // Prefill once the profile is available (it loads asynchronously after the token is read).
    effect(() => {
      const user = this.user();
      const control = this.form.controls.username;
      if (user && !control.dirty) {
        control.setValue(user.usernameDisplay || user.username);
      }
    });
  }

  /**
   * Scrolls to the targeted section once, if any; the top needs no scroll (the router already lands
   * there). The target is consumed so a later data load cannot pull the user back to it.
   */
  private scrollToTarget(): void {
    const section = this.targetSection;
    this.targetSection = 'account';
    if (section !== 'account') {
      setTimeout(() => this.scrollTo(section));
    }
  }

  protected scrollTo(section: ProfileSection): void {
    // A section the user picks wins over a pending arrival target.
    this.targetSection = 'account';
    this.activeSection.set(section);
    document.getElementById(`profile-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** The password page sends a reset email: not something a demo visitor may trigger. */
  protected onPasswordLink(): void {
    this.demoMode.blockWrite();
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
    if (this.demoMode.blockWrite()) {
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);

    this.userService.updateProfile(this.form.getRawValue()).subscribe({
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

  /** Saves the picked preset (null = initial); the navbar follows through the shared user state. */
  protected setAvatar(avatar: string | null): void {
    if (this.savingAvatar() || this.demoMode.blockWrite()) {
      return;
    }
    this.savingAvatar.set(true);
    this.userService.updateProfile({ avatar }).subscribe({
      next: () => {
        this.savingAvatar.set(false);
        this.avatarOpen.set(false);
        this.toast.success(this.translate.instant('profile.avatar.saved'));
      },
      error: (err) => {
        this.savingAvatar.set(false);
        this.toast.error(this.translate.instant(avatarErrorKey(err)));
      },
    });
  }

  protected setPlatform(value: string): void {
    if (findPlatformByKey(this.platformService.platforms() ?? [], value)) {
      this.preferences.setDefaultPlatform(value);
    }
  }

  protected exportData(format: ExportFormat): void {
    if (this.exporting() || this.demoMode.blockWrite()) {
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
