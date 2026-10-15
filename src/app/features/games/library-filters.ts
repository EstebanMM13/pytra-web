import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { PlatformRef } from '../../core/models/platform.model';
import { platformNameKey } from '../../core/services/platform.logic';
import { Combobox, ComboboxOption } from '../../shared/ui/combobox';
import { ICONS } from '../../shared/ui/icons';
import { GAME_CATEGORIES, LibraryCategoryFilter } from './library.logic';

/**
 * "Filtrar" button of the library toolbar with its panel: type (category), platforms and genres.
 * A bottom sheet on phones, a popover under the button from md. Changes apply right away; the
 * parent keeps them in the URL.
 */
@Component({
  selector: 'app-library-filters',
  imports: [TranslatePipe, LucideDynamicIcon, Combobox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
  template: `
    <button
      type="button"
      (click)="open.set(!open())"
      class="flex h-full items-center gap-2 rounded-xl border px-3.5 py-3 text-[13px] font-medium md:rounded-lg md:px-3 md:py-[9px]"
      [class]="count() ? 'border-brand bg-brand-tint text-brand-lighter' : 'border-border bg-surface text-text-2 hover:border-border-strong'"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="count() ? ('library.filters.buttonActive' | translate: { count: count() }) : null"
    >
      <svg [lucideIcon]="icons.slidersHorizontal" [size]="15" class="shrink-0"></svg>
      <span>{{ 'library.filters.button' | translate }}</span>
      @if (count()) {
        <span class="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 font-mono text-[11px] leading-5 text-white">
          {{ count() }}
        </span>
      }
    </button>

    @if (open()) {
      <div class="fixed inset-0 z-40 bg-black/50 md:hidden" (click)="close()" aria-hidden="true"></div>
      <div
        role="dialog"
        [attr.aria-label]="'library.filters.title' | translate"
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] animate-modal-in flex-col overflow-y-auto rounded-t-2xl border-t border-border bg-surface px-5 pt-4 pb-[max(env(safe-area-inset-bottom),20px)] md:absolute md:inset-x-auto md:top-full md:right-0 md:bottom-auto md:mt-2 md:max-h-[70vh] md:w-[380px] md:rounded-xl md:border md:p-4 md:shadow-[0_12px_32px_#0006]"
      >
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 class="text-[15px] font-semibold">{{ 'library.filters.title' | translate }}</h2>
          <button
            type="button"
            (click)="close()"
            class="grid size-8 place-items-center rounded-lg text-faint hover:bg-hover hover:text-text"
            [attr.aria-label]="'common.close' | translate"
          >
            <svg [lucideIcon]="icons.x" [size]="16"></svg>
          </button>
        </div>

        <section class="flex flex-col gap-2 border-t border-divider py-3.5">
          <h3 id="library-filter-type" class="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
            {{ 'library.filters.type' | translate }}
          </h3>
          <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="library-filter-type">
            @for (c of categoryChoices; track c) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="category() === c"
                (click)="categoryChange.emit(c)"
                class="rounded-full border px-3 py-1.5 text-[13px]"
                [class]="category() === c ? 'border-brand bg-brand-tint text-brand-lighter' : 'border-border text-text-2 hover:border-border-strong'"
              >
                {{ (c === 'ALL' ? 'library.categoryAllShort' : 'category.' + c) | translate }}
              </button>
            }
          </div>
        </section>

        @if (platforms().length) {
          <section class="flex flex-col gap-2 border-t border-divider py-3.5">
            <h3 id="library-filter-platforms" class="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
              {{ 'library.filters.platforms' | translate }}
            </h3>
            <div class="flex flex-wrap gap-1.5" role="group" aria-labelledby="library-filter-platforms">
              @for (p of platforms(); track p.id) {
                <button
                  type="button"
                  [attr.aria-pressed]="isPlatformPicked(p.id)"
                  (click)="togglePlatform(p.id)"
                  class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px]"
                  [class]="isPlatformPicked(p.id) ? 'border-brand bg-brand-tint text-brand-lighter' : 'border-border text-text-2 hover:border-border-strong'"
                >
                  <span
                    class="size-1.5 shrink-0 rounded-full bg-platform-neutral"
                    [style.background-color]="p.color"
                    aria-hidden="true"
                  ></span>
                  {{ platformLabel(p.name) | translate }}
                </button>
              }
            </div>
          </section>
        }

        @if (genreOptions().length) {
          <section class="flex flex-col gap-2 border-t border-divider py-3.5">
            <h3 id="library-filter-genres" class="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
              {{ 'library.filters.genres' | translate }}
            </h3>
            <app-combobox
              multiple
              labelledBy="library-filter-genres"
              [options]="genreOptions()"
              [selected]="genreIds()"
              (selectedChange)="genresChange.emit($event)"
              placeholder="library.filters.genresPlaceholder"
            />
            <p class="text-xs text-faint">{{ 'library.filters.anyHint' | translate }}</p>
          </section>
        }

        <div class="flex items-center justify-between gap-3 border-t border-divider pt-3.5">
          <button
            type="button"
            (click)="cleared.emit()"
            [disabled]="!count()"
            class="text-[13px] font-medium text-brand-light hover:underline disabled:opacity-40 disabled:hover:no-underline"
          >
            {{ 'library.filters.clear' | translate }}
          </button>
          <button
            type="button"
            (click)="close()"
            class="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-dark"
          >
            {{ 'library.filters.done' | translate }}
          </button>
        </div>
      </div>
    }
  `,
})
export class LibraryFilters {
  protected readonly icons = ICONS;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly category = input.required<LibraryCategoryFilter>();
  readonly platformIds = input.required<readonly string[]>();
  readonly genreIds = input.required<readonly number[]>();
  /** Platforms the library's games were played on. */
  readonly platforms = input.required<readonly PlatformRef[]>();
  /** Genres present in the library. */
  readonly genreOptions = input.required<readonly ComboboxOption[]>();

  readonly categoryChange = output<LibraryCategoryFilter>();
  readonly platformsChange = output<string[]>();
  readonly genresChange = output<readonly number[]>();
  readonly cleared = output<void>();

  protected readonly categoryChoices: readonly LibraryCategoryFilter[] = ['ALL', ...GAME_CATEGORIES];
  protected readonly open = signal(false);
  protected readonly count = computed(
    () => (this.category() !== 'ALL' ? 1 : 0) + this.platformIds().length + this.genreIds().length,
  );
  protected readonly platformLabel = (name: string): string => platformNameKey(name) ?? name;

  protected isPlatformPicked(id: number): boolean {
    return this.platformIds().includes(String(id));
  }

  protected togglePlatform(id: number): void {
    const key = String(id);
    const current = this.platformIds();
    this.platformsChange.emit(current.includes(key) ? current.filter((p) => p !== key) : [...current, key]);
  }

  close(): void {
    this.open.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    // Only the desktop popover closes on outside clicks; the mobile sheet has its own backdrop.
    const target = event.target as Node | null;
    if (this.open() && target && target.isConnected && !this.host.contains(target)) {
      this.close();
    }
  }
}
