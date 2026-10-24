import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DiaryDay } from '../../core/models/diary.model';
import { DiaryService } from '../../core/services/diary.service';
import { Navbar } from '../../shared/navbar/navbar';
import { ICONS } from '../../shared/ui/icons';
import { Skeleton } from '../../shared/ui/skeleton';
import { ratingLocale } from '../../shared/utils/rating-format';
import { todayIso } from '../../shared/utils/run-dates';
import { DiaryDayEditor } from './diary-day-editor';
import {
  CalendarCell,
  DiaryLevel,
  buildMonthGrid,
  dayLabel,
  formatDiaryHours,
  gridRange,
  isValidDiaryDate,
  monthLabel,
  monthOf,
  monthTotal,
  shiftMonth,
  weekdayLabels,
} from './diary.logic';

/** Cell background per heat level (brand purple: activity). */
const LEVEL_CLASS: Record<DiaryLevel, string> = {
  0: 'bg-hover/50',
  1: 'bg-[color-mix(in_srgb,var(--pt-brand)_22%,transparent)]',
  2: 'bg-[color-mix(in_srgb,var(--pt-brand)_42%,transparent)]',
  3: 'bg-[color-mix(in_srgb,var(--pt-brand)_66%,transparent)] text-white',
  4: 'bg-brand text-white',
};

/**
 * The play diary: a month calendar coloured by the hours played each day. Tapping a day opens its
 * editor; `/diary?date=yyyy-mm-dd` opens that day directly (dashboard card, daily reminder).
 */
@Component({
  selector: 'app-diary',
  imports: [Navbar, TranslatePipe, LucideDynamicIcon, Skeleton, DiaryDayEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diary.html',
})
export class Diary {
  protected readonly icons = ICONS;
  protected readonly levels: DiaryLevel[] = [0, 1, 2, 3, 4];

  private readonly diaryService = inject(DiaryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly today = signal(todayIso());
  private readonly current = monthOf(this.today())!;
  protected readonly year = signal(this.current.year);
  protected readonly month = signal(this.current.month);
  /** Days of the shown grid; null while loading. */
  protected readonly days = signal<DiaryDay[] | null>(null);
  protected readonly loadError = signal(false);
  /** Day open in the editor. */
  protected readonly editing = signal<string | null>(null);

  private readonly locale = computed(() => ratingLocale(this.translate.currentLang() ?? 'es'));
  protected readonly weekdays = computed(() => weekdayLabels(this.locale()));
  protected readonly title = computed(() => monthLabel(this.year(), this.month(), this.locale()));
  protected readonly weeks = computed(() =>
    buildMonthGrid(this.year(), this.month(), this.days() ?? [], this.today()),
  );
  protected readonly total = computed(() =>
    formatDiaryHours(monthTotal(this.days() ?? [], this.year(), this.month()), this.locale()),
  );
  protected readonly isCurrentMonth = computed(
    () => this.year() === this.current.year && this.month() === this.current.month,
  );
  /** The shown month's days with an entry, latest first. */
  protected readonly monthDays = computed(() => {
    const prefix = `${this.year()}-${String(this.month()).padStart(2, '0')}-`;
    return (this.days() ?? []).filter((d) => d.date.startsWith(prefix)).reverse();
  });

  private requestId = 0;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const date = params.get('date');
      if (isValidDiaryDate(date)) {
        const month = monthOf(date)!;
        if (month.year !== this.year() || month.month !== this.month() || this.days() === null) {
          this.showMonth(month.year, month.month);
        }
        this.editing.set(date);
      } else {
        this.editing.set(null);
        if (this.days() === null) this.load();
      }
    });
  }

  protected shift(delta: number): void {
    const next = shiftMonth(this.year(), this.month(), delta);
    this.showMonth(next.year, next.month);
  }

  protected goToToday(): void {
    this.showMonth(this.current.year, this.current.month);
  }

  protected open(date: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { date } });
  }

  protected openToday(): void {
    this.open(this.today());
  }

  protected closeEditor(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  /** After a save, refresh the month of the saved day (the editor's date may have been changed). */
  protected onSaved(date: string): void {
    this.closeEditor();
    const month = monthOf(date);
    if (month && (month.year !== this.year() || month.month !== this.month())) {
      this.showMonth(month.year, month.month);
    } else {
      this.load(true);
    }
  }

  protected retry(): void {
    this.load();
  }

  protected cellClass(cell: CalendarCell): string {
    const base = LEVEL_CLASS[cell.level];
    const muted = cell.inMonth ? '' : ' opacity-40';
    const today = cell.isToday ? ' ring-2 ring-inset ring-text-2 font-bold' : '';
    return `${base}${muted}${today}`;
  }

  protected legendClass(level: DiaryLevel): string {
    return LEVEL_CLASS[level];
  }

  protected cellLabel(cell: CalendarCell): string {
    const day = dayLabel(cell.date, this.locale(), this.year());
    return cell.hasEntry
      ? this.translate.instant('diary.calendar.dayWithHours', {
          day,
          hours: formatDiaryHours(cell.hours, this.locale()),
        })
      : day;
  }

  protected hours(value: number): string {
    return formatDiaryHours(value, this.locale());
  }

  protected shortHours(value: number): string {
    return new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 1 }).format(value);
  }

  protected dayTitle(date: string): string {
    return dayLabel(date, this.locale(), this.current.year);
  }

  protected gameNames(day: DiaryDay): string {
    return day.games
      .map((g) => g.gameName ?? '')
      .filter(Boolean)
      .join(' · ');
  }

  private showMonth(year: number, month: number): void {
    this.year.set(year);
    this.month.set(month);
    this.load();
  }

  /** `keepShown`: refresh the same month without blanking it (after a save). */
  private load(keepShown = false): void {
    const id = ++this.requestId;
    const { from, to } = gridRange(this.year(), this.month());
    if (!keepShown) this.days.set(null);
    this.loadError.set(false);
    this.diaryService.findRange(from, to).subscribe({
      next: (days) => {
        if (id === this.requestId) this.days.set(days);
      },
      error: () => {
        if (id !== this.requestId) return;
        this.days.set([]);
        this.loadError.set(true);
      },
    });
  }
}
