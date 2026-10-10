import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideChartColumn, LucidePlus, LucideSparkles, LucideTrendingDown } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { YearStat, YearSummary } from '../../core/models/stats.model';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { ToastService } from '../../shared/toast/toast.service';
import { MiniBar, MiniBarChart } from '../../shared/ui/mini-bar-chart';
import { SectionHeader } from '../../shared/ui/section-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatCard } from '../../shared/ui/stat-card';
import { formatRelativeTime } from '../../shared/utils/relative-time';
import {
  STATUS_TEXT,
  latestYear,
  monthLabels,
  monthValueLabel,
  parseYearParam,
  yearHighlight,
  yearTabs,
} from './years.logic';

/** Max length of each yearly note text (YearNoteRequestDto.MAX_LENGTH). */
export const NOTE_MAX_LENGTH = 10_000;
const HIGHLIGHT_LIMIT = 3;
const RUNS_PREVIEW = 10;

type SummaryState = { year: number; data: YearSummary | null; failed: boolean };

/**
 * Yearly summary (`/years/:year`). `/years` redirects to the most recent year with data,
 * or shows an empty state when there is none.
 */
@Component({
  selector: 'app-years',
  imports: [
    Navbar,
    RouterLink,
    TranslatePipe,
    HoursPipe,
    RatingPipe,
    StatCard,
    SectionHeader,
    MiniBarChart,
    Skeleton,
    LucideChartColumn,
    LucidePlus,
    LucideSparkles,
    LucideTrendingDown,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './years.html',
})
export class Years {
  private readonly statsService = inject(StatsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly runFormLauncher = inject(RunFormLauncher);

  protected readonly noteMax = NOTE_MAX_LENGTH;
  protected readonly statusText = STATUS_TEXT;
  protected readonly highlightLimit = HIGHLIGHT_LIMIT;

  /** Years with data (most recent first); null while loading. */
  protected readonly years = signal<number[] | null>(null);
  private readonly byYear = signal<YearStat[]>([]);
  /** Year in the URL; null on `/years`. */
  protected readonly year = signal<number | null>(null);
  private readonly state = signal<SummaryState | null>(null);

  protected readonly summary = computed(() => {
    const state = this.state();
    return state && state.year === this.year() ? state.data : null;
  });
  protected readonly failed = computed(() => {
    const state = this.state();
    return !!state && state.year === this.year() && state.failed;
  });
  protected readonly noYears = computed(() => this.year() === null && this.years()?.length === 0);

  protected readonly tabs = computed(() => yearTabs(this.years() ?? [], this.year()));

  protected readonly highlight = computed(() => {
    const summary = this.summary();
    return summary ? yearHighlight(summary, this.byYear()) : null;
  });

  private readonly lang = computed(() => (this.translate.currentLang() === 'en' ? 'en' : 'es'));

  protected readonly monthBars = computed<MiniBar[]>(() => {
    const months = this.summary()?.months ?? [];
    const labels = monthLabels(this.lang(), 'short');
    return months.map((m) => ({
      key: m.month,
      value: m.hours,
      label: labels[m.month - 1] ?? String(m.month),
      topLabel: monthValueLabel(m.hours) || null,
      title: `${labels[m.month - 1]}: ${Math.round(m.hours)} h`,
    }));
  });
  protected readonly monthBarsMobile = computed<MiniBar[]>(() => {
    const initials = monthLabels(this.lang(), 'initial');
    return this.monthBars().map((bar, i) => ({ ...bar, label: initials[i] ?? bar.label, topLabel: null }));
  });
  protected readonly hasMonthHours = computed(() => this.monthBars().some((b) => b.value > 0));

  protected readonly showAllRuns = signal(false);
  protected readonly visibleRuns = computed(() => {
    const runs = this.summary()?.experiences ?? [];
    return this.showAllRuns() ? runs : runs.slice(0, RUNS_PREVIEW);
  });
  protected readonly hiddenRuns = computed(() =>
    Math.max(0, (this.summary()?.experiences.length ?? 0) - RUNS_PREVIEW),
  );

  protected readonly mostPlayedMax = computed(() =>
    Math.max(0, ...(this.summary()?.mostPlayed ?? []).map((g) => g.totalHours)),
  );

  // Yearly note editor.
  protected readonly noteSummary = signal('');
  protected readonly noteHighlights = signal('');
  private readonly savedNote = signal({ summary: '', highlights: '' });
  protected readonly noteUpdatedAt = signal<string | null>(null);
  protected readonly savingNote = signal(false);
  protected readonly noteDirty = computed(
    () =>
      this.noteSummary() !== this.savedNote().summary || this.noteHighlights() !== this.savedNote().highlights,
  );
  protected readonly noteTooLong = computed(
    () => this.noteSummary().length > NOTE_MAX_LENGTH || this.noteHighlights().length > NOTE_MAX_LENGTH,
  );
  protected readonly noteSavedAgo = computed(() => formatRelativeTime(this.noteUpdatedAt(), this.lang()));

  private readonly load$ = new Subject<number>();

  constructor() {
    this.load$
      .pipe(
        switchMap((year) =>
          this.statsService.getYearSummary(year).pipe(
            map((data): SummaryState => ({ year, data, failed: false })),
            catchError(() => of<SummaryState>({ year, data: null, failed: true })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => {
        const refresh = this.state()?.year === state.year && !!this.state()?.data;
        this.state.set(state);
        // Keep unsaved note edits when the same year is refreshed (e.g. after saving a run).
        if (state.data && !(refresh && this.noteDirty())) {
          this.resetNote(state.data);
        }
      });

    this.statsService
      .getYears()
      .pipe(catchError(() => of([] as number[])))
      .subscribe((years) => {
        this.years.set(years);
        this.redirectToLatest();
      });
    this.statsService
      .getByYear()
      .pipe(catchError(() => of([] as YearStat[])))
      .subscribe((stats) => this.byYear.set(stats));

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const raw = params.get('year');
      const year = parseYearParam(raw);
      if (raw !== null && year === null) {
        this.router.navigate(['/years'], { replaceUrl: true });
        return;
      }
      this.year.set(year);
      this.showAllRuns.set(false);
      if (year !== null) {
        this.load$.next(year);
      } else {
        this.redirectToLatest();
      }
    });

    // A run created or edited elsewhere changes the totals.
    this.runFormLauncher.saved$.pipe(takeUntilDestroyed()).subscribe(() => this.reload());
  }

  /** `/years` lands on the most recent year with data. */
  private redirectToLatest(): void {
    const latest = latestYear(this.years() ?? []);
    if (this.year() === null && latest !== null) {
      this.router.navigate(['/years', latest], { replaceUrl: true });
    }
  }

  protected reload(): void {
    const year = this.year();
    if (year !== null) {
      this.load$.next(year);
    }
  }

  protected newRun(): void {
    this.runFormLauncher.openNewRun();
  }

  protected barWidth(hours: number): number {
    const max = this.mostPlayedMax();
    return max > 0 ? (hours / max) * 100 : 0;
  }

  private resetNote(summary: YearSummary): void {
    const saved = { summary: summary.note.summary ?? '', highlights: summary.note.highlights ?? '' };
    this.savedNote.set(saved);
    this.noteSummary.set(saved.summary);
    this.noteHighlights.set(saved.highlights);
    this.noteUpdatedAt.set(summary.note.updatedAt);
  }

  protected saveNote(): void {
    const year = this.year();
    if (year === null || this.savingNote() || this.noteTooLong()) {
      return;
    }
    const request = {
      summary: this.noteSummary().trim() || null,
      highlights: this.noteHighlights().trim() || null,
    };
    this.savingNote.set(true);
    this.statsService.saveYearNote(year, request).subscribe({
      next: (note) => {
        this.savingNote.set(false);
        this.toast.success(this.translate.instant('years.note.saved'));
        // The user may have switched years meanwhile: never put this note in another year's editor.
        if (year !== this.year()) {
          return;
        }
        const saved = { summary: note.summary ?? '', highlights: note.highlights ?? '' };
        this.savedNote.set(saved);
        this.noteSummary.set(saved.summary);
        this.noteHighlights.set(saved.highlights);
        this.noteUpdatedAt.set(note.updatedAt);
      },
      error: () => {
        this.savingNote.set(false);
        this.toast.error(this.translate.instant('years.note.saveError'));
      },
    });
  }

  protected formatCount(value: number): string {
    return value.toLocaleString(this.lang() === 'en' ? 'en-US' : 'es-ES');
  }
}
