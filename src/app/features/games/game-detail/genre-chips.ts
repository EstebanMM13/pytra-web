import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CollapseStateService } from '../../../core/services/collapse-state.service';
import { ModalSheet } from '../../../shared/ui/modal-sheet';

/** Genre chips the game hero shows before folding the rest into "+N". */
export const HERO_GENRE_LIMIT = 2;

/** The first `limit` genres, plus how many are left for the "+N" chip. */
export function splitGenres(genres: readonly string[], limit = HERO_GENRE_LIMIT): { shown: string[]; hidden: number } {
  const max = Math.max(0, limit);
  return { shown: genres.slice(0, max), hidden: Math.max(0, genres.length - max) };
}

/**
 * Genre chips of the game hero: at most two, then a "+N" chip that lists them all in a popover
 * (md+; it opens upwards since the hero clips overflow and the genres sit at its bottom) or a
 * view-only sheet (phones), so a long genre list never makes the hero taller than its cover.
 */
@Component({
  selector: 'app-genre-chips',
  imports: [TranslatePipe, ModalSheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative flex flex-wrap items-center gap-1.5 md:gap-2',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'popover.set(false)',
  },
  template: `
    @for (genre of split().shown; track genre) {
      <span class="rounded-full border border-brand/25 bg-brand-tint font-medium text-brand-lighter" [class]="chipClass()">
        {{ genre }}
      </span>
    }
    @if (split().hidden) {
      <button
        type="button"
        (click)="openAll()"
        class="rounded-full border border-border bg-surface/60 font-medium text-text-2 hover:border-border-strong hover:text-text"
        [class]="chipClass()"
        aria-haspopup="dialog"
        [attr.aria-expanded]="popover() || sheet()"
        [attr.aria-label]="'game.allGenres' | translate: { count: genres().length }"
        data-more-genres
      >
        +{{ split().hidden }}
      </button>
    }
    @if (popover()) {
      <div
        role="dialog"
        [attr.aria-label]="'game.genre' | translate"
        class="absolute bottom-full left-0 z-30 mb-2 w-max max-w-[320px] animate-modal-in rounded-xl border border-border bg-surface p-3 shadow-[0_12px_32px_#0006]"
        data-genre-popover
      >
        <ul class="flex flex-wrap gap-1.5">
          @for (genre of genres(); track genre) {
            <li class="rounded-full border border-brand/25 bg-brand-tint px-2.5 py-0.5 text-xs font-medium text-brand-lighter">
              {{ genre }}
            </li>
          }
        </ul>
      </div>
    }
    @if (sheet()) {
      <app-modal-sheet viewOnly [title]="'game.genre' | translate" (closed)="sheet.set(false)">
        <ul class="flex flex-col divide-y divide-divider">
          @for (genre of genres(); track genre) {
            <li class="py-3 text-[15px] text-text-2">{{ genre }}</li>
          }
        </ul>
      </app-modal-sheet>
    }
  `,
})
export class GenreChips {
  /** Display names, already sorted. */
  readonly genres = input.required<readonly string[]>();
  /** Chip size: compact beside the cover on phones, roomier in the web hero. */
  readonly size = input<'sm' | 'md'>('sm');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly wide = inject(CollapseStateService).atLeast('md');

  protected readonly split = computed(() => splitGenres(this.genres()));
  protected readonly chipClass = computed(() =>
    this.size() === 'md' ? 'px-3 py-1 text-[13px]' : 'px-2.5 py-0.5 text-xs',
  );
  protected readonly popover = signal(false);
  protected readonly sheet = signal(false);

  protected openAll(): void {
    if (this.wide()) {
      this.popover.update((open) => !open);
    } else {
      this.sheet.set(true);
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (this.popover() && target?.isConnected && !this.host.contains(target)) {
      this.popover.set(false);
    }
  }
}
