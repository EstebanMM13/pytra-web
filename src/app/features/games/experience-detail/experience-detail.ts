import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS } from '../../../shared/ui/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Experience, ExperiencePatch } from '../../../core/models/experience.model';
import { Game } from '../../../core/models/game.model';
import { DemoModeService } from '../../../core/services/demo-mode.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { RunFormLauncher } from '../../../core/services/run-form-launcher.service';
import { StatsService } from '../../../core/services/stats.service';
import { Navbar } from '../../../shared/navbar/navbar';
import { HoursPipe } from '../../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../../shared/pipes/rating.pipe';
import { PlatformLabel } from '../../../shared/ui/platform-label';
import { RatingTonePipe } from '../../../shared/pipes/rating-tone.pipe';
import { ToastService } from '../../../shared/toast/toast.service';
import { SectionHeader } from '../../../shared/ui/section-header';
import { Skeleton } from '../../../shared/ui/skeleton';
import { figureFontSize } from '../../../shared/ui/stat-card';
import { StatusPill } from '../../../shared/ui/status-pill';
import { translatePlural } from '../../../shared/utils/plural';
import { formatDayMonthYear, runDuration, splitLines } from '../../../shared/utils/run-dates';
import { toastApiError } from '../../../shared/utils/api-error';
import { formatDecimalInput } from '../../../shared/utils/decimal-input';
import { ratingInputParams } from '../../../shared/utils/rating-scale';
import { HOUR_STEPS, InlineField, bumpHoursDraft, inlineDraft, parseInlineEdit } from './inline-edit.logic';

/** `/stats/top-rated` caps `limit` at 50 server-side. */
const RANK_WINDOW = 50;

/**
 * Position of `rating` among the user's ratings (1 = best; ties share a position), from the
 * best-first `topRatings` window. Null when the window is full and does not reach `rating`.
 */
export function ratingRank(rating: number, topRatings: readonly number[], windowSize = RANK_WINDOW): number | null {
  const better = topRatings.filter((r) => r > rating).length;
  const complete = topRatings.length < windowSize;
  return complete || better < topRatings.length ? better + 1 : null;
}

@Component({
  selector: 'app-experience-detail',
  imports: [
    RouterLink,
    TranslatePipe,
    Navbar,
    HoursPipe,
    RatingPipe,
    RatingTonePipe,
    PlatformLabel,
    SectionHeader,
    Skeleton,
    StatusPill,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './experience-detail.html',
  styleUrls: ['./experience-detail.css', '../../../shared/ui/platinum-glow.css'],
})
export class ExperienceDetail {
  protected readonly icons = ICONS;
  /** Figure font size that fits its tile (see `figureFontSize`). */
  protected readonly figureSize = (value: string | number): string => figureFontSize(String(value));
  /** Inline-editable figures share their row with the pencil chip (26px chip + 8px gap + 12px padding, 2px slack). */
  protected readonly editableFigureSize = (value: string | number): string => figureFontSize(String(value), 48);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly experienceService = inject(ExperienceService);
  private readonly gameService = inject(GameService);
  private readonly statsService = inject(StatsService);
  private readonly runFormLauncher = inject(RunFormLauncher);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly demo = inject(DemoModeService);
  private readonly injector = inject(Injector);
  protected readonly preferences = inject(PreferencesService);

  readonly gameId = signal(0);
  private readonly experienceId = signal(0);

  readonly experience = signal<Experience | null>(null);
  readonly game = signal<Game | null>(null);
  readonly loadError = signal(false);
  readonly deleting = signal(false);
  /** Best ratings first, as returned by `/stats/top-rated`; `null` until loaded or on failure. */
  private readonly topRatings = signal<number[] | null>(null);

  // --- Inline edit of the hours and the rating (tap the figure, Enter/blur saves, Esc cancels) ---
  /** Figure being edited inline, if any. */
  readonly editing = signal<InlineField | null>(null);
  /** Raw text of the inline input ("12,5"). */
  readonly draft = signal('');
  readonly draftInvalid = signal(false);
  /** An inline change is on its way: the figures stay read-only until it settles. */
  readonly inlineSaving = signal(false);
  /** Polite announcement for screen readers once an inline change is saved. */
  protected readonly inlineStatus = signal('');
  protected readonly hourSteps = HOUR_STEPS;

  protected readonly pros = computed(() => splitLines(this.experience()?.pros));
  protected readonly cons = computed(() => splitLines(this.experience()?.cons));

  protected readonly rank = computed(() => {
    const rating = this.experience()?.rating;
    const top = this.topRatings();
    return rating === null || rating === undefined || top === null ? null : ratingRank(rating, top);
  });

  protected readonly duration = computed(() => {
    const e = this.experience();
    return e ? runDuration(e.startDate, e.endDate) : null;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.load(Number(params.get('gameId')), Number(params.get('id')));
    });

    this.statsService.getTopRated(RANK_WINDOW).subscribe({
      next: (top) => this.topRatings.set(top.map((t) => t.rating)),
      error: () => {},
    });

    this.runFormLauncher.saved$.pipe(takeUntilDestroyed()).subscribe(({ experience }) => {
      if (experience.id === this.experienceId()) {
        this.experience.set(experience);
        // The rating may have changed: refresh the ranking window.
        this.refreshTopRatings();
      }
    });
  }

  private refreshTopRatings(): void {
    this.statsService.getTopRated(RANK_WINDOW).subscribe({
      next: (top) => this.topRatings.set(top.map((t) => t.rating)),
      error: () => this.topRatings.set(null),
    });
  }

  private load(gameId: number, experienceId: number): void {
    this.gameId.set(gameId);
    this.experienceId.set(experienceId);
    this.experience.set(null);
    this.loadError.set(false);
    this.editing.set(null);

    // Ignore late answers for a run/game the user already navigated away from.
    this.experienceService.findById(experienceId).subscribe({
      next: (experience) => {
        if (experienceId === this.experienceId()) this.experience.set(experience);
      },
      error: () => {
        if (experienceId === this.experienceId()) this.loadError.set(true);
      },
    });
    if (this.game()?.id !== gameId) {
      // Seeded from the cached library list when available (instant hero), then refreshed.
      this.game.set(this.gameService.cachedById(gameId));
      this.gameService.findById(gameId).subscribe({
        next: (game) => {
          if (gameId === this.gameId()) this.game.set(game);
        },
        error: () => {},
      });
    }
  }

  protected date(value: string | null): string {
    return formatDayMonthYear(value);
  }

  protected durationLabel(short: boolean): string {
    const d = this.duration();
    if (!d) {
      return '—';
    }
    if (short) {
      return this.translate.instant(d.unit === 'months' ? 'run.monthsShort' : 'run.daysShort', { count: d.count });
    }
    return translatePlural(this.translate, d.unit === 'months' ? 'run.months' : 'run.days', d.count);
  }

  /** Scale bound and examples for the inline rating placeholder, labels and error. */
  protected ratingParams(): ReturnType<typeof ratingInputParams> {
    return ratingInputParams(this.preferences.ratingScale(), this.preferences.ratingPrecision(), this.lang());
  }

  private lang(): string {
    return this.translate.currentLang() === 'en' ? 'en' : 'es';
  }

  /** "0,5" / "1" in the UI language, for the quick hour steps. */
  protected stepLabel(step: number): string {
    return formatDecimalInput(step, this.lang());
  }

  protected startEdit(field: InlineField): void {
    const experience = this.experience();
    if (!experience || this.inlineSaving()) {
      return;
    }
    this.draft.set(inlineDraft(field, experience, this.lang(), this.preferences.ratingScale()));
    this.draftInvalid.set(false);
    this.inlineStatus.set('');
    this.editing.set(field);
    afterNextRender(
      () => {
        const input = document.getElementById(`run-inline-${field}`) as HTMLInputElement | null;
        input?.focus();
        input?.select();
      },
      { injector: this.injector },
    );
  }

  protected onDraftInput(value: string): void {
    this.draft.set(value);
    this.draftInvalid.set(false);
  }

  protected bumpHours(step: number): void {
    this.draft.set(bumpHoursDraft(this.draft(), this.experience()?.hours ?? null, step, this.lang()));
    this.draftInvalid.set(false);
  }

  protected cancelEdit(): void {
    const field = this.editing();
    if (field) {
      this.closeEditor(field, true);
    }
  }

  /** Focus left the inline editor (its input and quick buttons): save, or drop an invalid value. */
  protected onEditorFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as HTMLElement).contains(next)) {
      return;
    }
    this.commitEdit(true);
  }

  /**
   * Saves the typed value. Invalid text keeps the editor open with its error (Enter) or is dropped
   * (focus left). The figure updates at once and rolls back with an error toast if the save fails.
   */
  protected commitEdit(fromBlur = false): void {
    const field = this.editing();
    const experience = this.experience();
    if (!field || !experience) {
      return;
    }
    const result = parseInlineEdit(
      field,
      this.draft(),
      experience,
      this.preferences.ratingPrecision(),
      this.preferences.ratingScale(),
    );
    if (result.kind === 'invalid' && !fromBlur) {
      this.draftInvalid.set(true);
      return;
    }
    this.closeEditor(field, !fromBlur);
    if (result.kind === 'change' && !this.demo.blockWrite()) {
      this.saveInline(experience, result.patch);
    }
  }

  private closeEditor(field: InlineField, restoreFocus: boolean): void {
    this.editing.set(null);
    this.draftInvalid.set(false);
    if (restoreFocus) {
      afterNextRender(() => document.getElementById(`run-inline-${field}-trigger`)?.focus(), {
        injector: this.injector,
      });
    }
  }

  private saveInline(previous: Experience, patch: ExperiencePatch): void {
    const id = previous.id;
    this.inlineSaving.set(true);
    this.experience.set({ ...previous, ...patch });
    this.experienceService.patch(id, patch).subscribe({
      next: (saved) => {
        this.inlineSaving.set(false);
        if (id !== this.experienceId()) return;
        this.experience.set(saved);
        this.inlineStatus.set(this.translate.instant('run.inlineSaved'));
        if ('rating' in patch) {
          this.refreshTopRatings();
        }
      },
      error: (err: unknown) => {
        this.inlineSaving.set(false);
        if (id === this.experienceId()) this.experience.set(previous);
        toastApiError(this.toast, this.translate, err, 'run.inlineSaveError');
      },
    });
  }

  protected edit(): void {
    const experience = this.experience();
    if (experience) {
      this.runFormLauncher.openEditRun(experience);
    }
  }

  protected remove(): void {
    const experience = this.experience();
    if (!experience || this.deleting() || !confirm(this.translate.instant('run.deleteConfirm'))) {
      return;
    }
    this.deleting.set(true);
    this.experienceService.delete(experience.id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('run.deleted'));
        this.router.navigate(['/games', this.gameId()]);
      },
      error: (err: unknown) => {
        this.deleting.set(false);
        toastApiError(this.toast, this.translate, err, 'run.deleteError');
      },
    });
  }
}
