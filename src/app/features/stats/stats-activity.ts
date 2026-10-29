import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Streak } from '../../core/models/stats.model';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { ICONS } from '../../shared/ui/icons';
import { MiniBar, MiniBarChart } from '../../shared/ui/mini-bar-chart';
import { SectionHeader } from '../../shared/ui/section-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatCard } from '../../shared/ui/stat-card';
import { DIARY_LEVEL_CLASS, DiaryLevel } from '../diary/diary.logic';
import { monthLabels, monthValueLabel } from '../years/years.logic';
import { statsFormat } from './stats-format';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { StatsScope } from './stats-scope';
import { statsSection } from './stats-section';
import {
  HEATMAP_HALVES,
  HeatCell,
  activityYears,
  buildHeatmap,
  isoToUtcDate,
  weekdayDate,
  weekdayShortLabels,
} from './stats.logic';

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
    StatsLoadError,
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
  private readonly format = statsFormat();

  protected readonly section = statsSection((year) => this.stats.getActivity(year));
  protected readonly state = this.section.state;
  private readonly currentYear = new Date().getFullYear();

  /** The year on screen: the API's answer, else the requested one, else the current year. */
  protected readonly viewYear = computed(() => this.state().data?.year ?? this.section.year() ?? this.currentYear);
  protected readonly yearOptions = computed(() =>
    activityYears(this.section.years(), this.currentYear, this.viewYear()),
  );

  protected readonly months = computed(() => monthLabels(this.format.lang(), 'short'));
  /** Monday, Wednesday and Friday rows are labelled (GitHub style); the others stay blank. */
  protected readonly rowLabels = computed(() =>
    weekdayShortLabels(this.format.locale()).map((label, i) => (i % 2 === 0 && i < 6 ? label : '')),
  );

  protected readonly heatmap = computed(() => {
    const data = this.state().data;
    return data ? buildHeatmap(data.year, data.days) : null;
  });
  protected readonly halves = computed(() => {
    const data = this.state().data;
    return data ? HEATMAP_HALVES.map((half) => buildHeatmap(data.year, data.days, half.fromMonth, half.toMonth)) : [];
  });

  /** Day picked on the heatmap (a tap on phones, where there is no hover title). */
  protected readonly picked = signal<HeatCell | null>(null);

  protected readonly weekdayBars = computed<MiniBar[]>(() => {
    const data = this.state().data;
    if (!data) return [];
    const f = this.format;
    const narrow = new Intl.DateTimeFormat(f.locale(), { weekday: 'narrow', timeZone: 'UTC' });
    const long = new Intl.DateTimeFormat(f.locale(), { weekday: 'long', timeZone: 'UTC' });
    return data.weekdays.map((day) => {
      const date = weekdayDate(day.dayOfWeek);
      return {
        key: day.dayOfWeek,
        value: day.hours,
        label: narrow.format(date),
        subLabel: monthValueLabel(day.hours) || null,
        title: f.text('stats.activity.weekdayTitle', {
          day: long.format(date),
          hours: f.hours(day.hours),
          days: f.plural('stats.days', day.daysPlayed),
        }),
      };
    });
  });

  /** Hover / tap text of every day, built once per data or language change (not per cell render). */
  private readonly cellTitles = computed(() => {
    const map = this.heatmap();
    const titles = new Map<string, string>();
    if (!map) return titles;
    const f = this.format;
    const day = new Intl.DateTimeFormat(f.locale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    for (const cell of map.cells) {
      if (!cell) continue;
      titles.set(
        cell.date,
        f.text('stats.activity.dayTitle', { day: day.format(isoToUtcDate(cell.date)), hours: f.hours(cell.hours) }),
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

  /** "12 oct – 20 oct" (with the year when the streak is outside the viewed year). */
  protected streakRange(streak: Streak): string | null {
    if (!streak.startDate || !streak.endDate || streak.length === 0) return null;
    const year = this.viewYear();
    const short = (iso: string): string => {
      const date = isoToUtcDate(iso);
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };
      if (date.getUTCFullYear() !== year) options.year = 'numeric';
      return new Intl.DateTimeFormat(this.format.locale(), options).format(date);
    };
    return this.format.text('stats.activity.streakRange', { from: short(streak.startDate), to: short(streak.endDate) });
  }

  protected columnsStyle(columns: number): string {
    return `repeat(${columns}, minmax(0, 1fr))`;
  }
}
