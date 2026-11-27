import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { GameDiaryDay } from '../../../core/models/diary.model';
import { DiaryService } from '../../../core/services/diary.service';
import { SectionHeader } from '../../../shared/ui/section-header';
import { ratingLocale } from '../../../shared/utils/rating-format';
import { dayLabel } from '../../diary/diary.logic';
import { formatHours } from '../../../shared/pipes/hours.pipe';

/**
 * "Days played" card: the diary days of the game, latest first, each linking to that day in the diary.
 * Given a run (`experienceId`), only the days of that run. Past six rows the list scrolls inside the card
 * (6 x 39px rows + the scroll-list 2px). Hidden while there are no days to show.
 */
@Component({
  selector: 'app-game-diary-days',
  imports: [TranslatePipe, RouterLink, SectionHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown().length) {
      <section
        class="rounded-[14px] border border-card-border card-glass p-[18px] md:p-[22px]"
        data-diary-days
      >
        <app-section-header
          [collapseKey]="experienceId() === null ? 'game.diaryDays' : 'run.diaryDays'"
          class="mb-3"
          [label]="'game.diaryDays' | translate"
        >
          <span class="font-mono text-label text-text-3">{{ total() }}</span>
        </app-section-header>
        <ul class="scroll-list max-h-[236px] text-sm">
          @for (day of shown(); track day.date) {
            <li class="border-t border-divider">
              <a
                [routerLink]="['/diary']"
                [queryParams]="{ date: day.date }"
                class="flex items-center justify-between gap-4 py-[9px] hover:text-text"
              >
                <span
                  class="min-w-0 truncate capitalize text-text-2"
                  [attr.title]="day.note ?? null"
                  >{{ label(day.date) }}</span
                >
                <span class="shrink-0 font-mono">{{ hours(day.hours) }}</span>
              </a>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class GameDiaryDays {
  private readonly diaryService = inject(DiaryService);
  private readonly translate = inject(TranslateService);

  readonly gameId = input.required<number>();
  /** Run whose days to show; `null` shows every day of the game, online ones included. */
  readonly experienceId = input<number | null>(null);

  protected readonly days = signal<GameDiaryDay[] | null>(null);

  private readonly locale = computed(() => ratingLocale(this.translate.currentLang() ?? 'es'));
  protected readonly shown = computed(() => {
    const days = this.days() ?? [];
    const run = this.experienceId();
    return run === null ? days : days.filter((d) => d.experienceId === run);
  });
  protected readonly total = computed(() =>
    formatHours(
      this.shown().reduce((sum, d) => sum + d.hours, 0),
      this.locale(),
    ),
  );

  constructor() {
    effect((onCleanup) => {
      const id = this.gameId();
      this.days.set(null);
      const subscription = this.diaryService.findByGame(id).subscribe({
        next: (days) => this.days.set(days),
        // Optional card: a failure just leaves it hidden.
        error: () => this.days.set([]),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected label(date: string): string {
    return dayLabel(date, this.locale(), new Date().getFullYear());
  }

  protected hours(value: number): string {
    return formatHours(value, this.locale());
  }
}
