import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Streak } from '../../core/models/stats.model';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe, formatHours } from '../../shared/pipes/hours.pipe';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { ICONS } from '../../shared/ui/icons';
import { MiniBar, MiniBarChart } from '../../shared/ui/mini-bar-chart';
import { SectionHeader } from '../../shared/ui/section-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatCard } from '../../shared/ui/stat-card';
import { translatePlural } from '../../shared/utils/plural';
import { ratingLocale } from '../../shared/utils/rating-format';
import { DIARY_LEVEL_CLASS, DiaryLevel, dayLabel } from '../diary/diary.logic';
import { monthLabels, monthValueLabel } from '../years/years.logic';
import { StatsPageHeader } from './stats-page-header';
import { StatsScope } from './stats-scope';
import { statsSection } from './stats-section';
import { HeatCell, activityYears, buildHeatmap, weekdayShortLabels } from './stats.logic';

/**
 * Activity section (`/stats/activity?year=`): the year's diary days as a GitHub-style heatmap
 * (two half-year strips on phones so the cells stay tappable, one strip from md), streaks and
 * hours per weekday. Without `year` the API answers for the current year.
 */
@Component({
  selector: 'app-stats-activity',
  imports: [
    Navbar,
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    TranslatePluralPipe,
    HoursPipe,
    LucideDynamicIcon,
    MiniBarChart,
    SectionHeader,
    Skeleton,
    StatCard,
    StatsPageHeader,
    StatsScope,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats-activity.html',
})
export class StatsActivity {
  protected readonly icons = ICONS;
  protected readonly levels: DiaryLevel[] = [0, 1, 2, 3, 4];
  protected readonly levelClass = DIARY_LEVEL_CLASS;
  private readonly stats = inject(StatsService);
  private readonly translate = inject(TranslateService);

  protected readonly section = statsSection((year) => this.stats.getActivity(year));
  protected readonly state = this.section.state;
  private readonly currentYear = new Date().getFullYear();

  /** The year on screen: the API's answer, else the requested one, else the current year. */
  protected readonly viewYear = computed(() => this.state().data?.year ?? this.section.year() ?? this.currentYear);
  protected readonly yearOptions = computed(() =>
    activityYears(this.section.years(), this.currentYear, this.viewYear()),
  );

  private readonly lang = computed(() => (this.translate.currentLang() === 'en' ? 'en' : 'es'));
  private readonly locale = computed(() => ratingLocale(this.lang()));
  protected readonly months = computed(() => monthLabels(this.lang(), 'short'));
  /** Monday, Wednesday and Friday rows are labelled (GitHub style); the others stay blank. */
  protected readonly rowLabels = computed(() =>
    weekdayShortLabels(this.locale()).map((label, i) => (i % 2 === 0 && i < 6 ? label : '')),
  );

  protected readonly heatmap = computed(() => {
    const data = this.state().data;
    return data ? buildHeatmap(data.year, data.days) : null;
  });
  protected readonly halves = computed(() => {
    const data = this.state().data;
    return data ? [buildHeatmap(data.year, data.days, 0, 5), buildHeatmap(data.year, data.days, 6, 11)] : [];
  });

  /** Day picked on the heatmap (a tap on phones, where there is no hover title). */
  protected readonly picked = signal<HeatCell | null>(null);

  protected readonly weekdayBars = computed<MiniBar[]>(() => {
    const data = this.state().data;
    if (!data) return [];
    const narrow = new Intl.DateTimeFormat(this.locale(), { weekday: 'narrow', timeZone: 'UTC' });
    const long = new Intl.DateTimeFormat(this.locale(), { weekday: 'long', timeZone: 'UTC' });
    return data.weekdays.map((day) => {
      // 2024-01-01 was a Monday.
      const date = new Date(Date.UTC(2024, 0, day.dayOfWeek));
      return {
        key: day.dayOfWeek,
        value: day.hours,
        label: narrow.format(date),
        subLabel: monthValueLabel(day.hours) || null,
        title: this.translate.instant('stats.activity.weekdayTitle', {
          day: long.format(date),
          hours: formatHours(day.hours, this.locale()),
          days: translatePlural(this.translate, 'stats.days', day.daysPlayed),
        }),
      };
    });
  });

  /** Hover / tap text of every day, built once per data or language change (not per cell render). */
  private readonly cellTitles = computed(() => {
    const map = this.heatmap();
    const titles = new Map<string, string>();
    if (!map) return titles;
    const locale = this.locale();
    const format = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    for (const cell of map.cells) {
      if (!cell) continue;
      const [y, m, d] = cell.date.split('-').map(Number);
      titles.set(
        cell.date,
        this.translate.instant('stats.activity.dayTitle', {
          day: format.format(new Date(Date.UTC(y, m - 1, d))),
          hours: formatHours(cell.hours, locale),
        }),
      );
    }
    return titles;
  });

  protected cellTitle(cell: HeatCell): string {
    return this.cellTitles().get(cell.date) ?? cell.date;
  }

  protected cellClass(cell: HeatCell): string {
    return DIARY_LEVEL_CLASS[cell.level] + (this.picked()?.date === cell.date ? ' ring-1 ring-text' : '');
  }

  protected pick(cell: HeatCell): void {
    this.picked.set(this.picked()?.date === cell.date ? null : cell);
  }

  /** "12 oct – 20 oct" (with years when the streak is not in the viewed year). */
  protected streakRange(streak: Streak): string | null {
    if (!streak.startDate || !streak.endDate || streak.length === 0) return null;
    const year = this.viewYear();
    return this.translate.instant('stats.activity.streakRange', {
      from: dayLabel(streak.startDate, this.locale(), year),
      to: dayLabel(streak.endDate, this.locale(), year),
    });
  }

  protected columnsStyle(columns: number): string {
    return `repeat(${columns}, minmax(0, 1fr))`;
  }
}
