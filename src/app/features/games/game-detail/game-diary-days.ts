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
import { dayLabel, formatDiaryHours } from '../../diary/diary.logic';

/** Days shown before "show all". */
const VISIBLE_DAYS = 8;

/**
 * "Days played" card of the game detail: the diary days of the game, latest first, each linking to
 * that day in the diary. Hidden while the game has no diary days.
 */
@Component({
  selector: 'app-game-diary-days',
  imports: [TranslatePipe, RouterLink, SectionHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (days()?.length) {
      <section
        class="rounded-[14px] border border-card-border card-glass p-[18px] md:p-[22px]"
        data-diary-days
      >
        <app-section-header
          collapseKey="game.diaryDays"
          class="mb-3"
          [label]="'game.diaryDays' | translate"
        >
          <span class="font-mono text-[13px] text-text-3">{{ total() }}</span>
        </app-section-header>
        <ul class="text-sm">
          @for (day of visible(); track day.date) {
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
        @if (hiddenCount() > 0) {
          <button
            type="button"
            (click)="expanded.set(true)"
            class="tap-area mt-2 text-[13px] font-semibold text-brand-light hover:underline"
          >
            {{ 'common.showAll' | translate }} ({{ days()!.length }})
          </button>
        }
      </section>
    }
  `,
})
export class GameDiaryDays {
  private readonly diaryService = inject(DiaryService);
  private readonly translate = inject(TranslateService);

  readonly gameId = input.required<number>();

  protected readonly days = signal<GameDiaryDay[] | null>(null);
  protected readonly expanded = signal(false);

  private readonly locale = computed(() => ratingLocale(this.translate.currentLang() ?? 'es'));
  protected readonly visible = computed(() => {
    const days = this.days() ?? [];
    return this.expanded() ? days : days.slice(0, VISIBLE_DAYS);
  });
  protected readonly hiddenCount = computed(
    () => (this.days()?.length ?? 0) - this.visible().length,
  );
  protected readonly total = computed(() =>
    formatDiaryHours(
      (this.days() ?? []).reduce((sum, d) => sum + d.hours, 0),
      this.locale(),
    ),
  );

  constructor() {
    effect((onCleanup) => {
      const id = this.gameId();
      this.days.set(null);
      this.expanded.set(false);
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
    return formatDiaryHours(value, this.locale());
  }
}
