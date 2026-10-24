import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CollapseStateService } from '../../core/services/collapse-state.service';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { PlatformRef } from '../../core/models/platform.model';
import { platformNameKey } from '../../core/services/platform.logic';
import { Combobox, ComboboxOption } from '../../shared/ui/combobox';
import { ICONS } from '../../shared/ui/icons';
import { GAME_CATEGORIES, LIBRARY_SORTS, LibraryCategoryFilter, LibrarySort } from './library.logic';

/**
 * "Filtrar y ordenar" button of the library toolbar with its panel: sort, type (category), platforms, genres,
 * developers and publishers.
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
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    <button
      #trigger
      type="button"
      (click)="toggle()"
      class="relative flex h-11 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap sm:px-4 md:h-9 md:px-3.5"
      [class]="count() ? 'border-brand-line bg-brand-tint text-text' : 'border-border bg-surface text-text-2 hover:border-border-strong'"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="
        (count() ? 'library.filters.buttonActive' : 'library.filters.button') | translate: { count: count() }
      "
    >
      <svg [lucideIcon]="icons.slidersHorizontal" [size]="15" class="shrink-0"></svg>
      <!-- Icon only on phones so the search placeholder fits; the aria-label keeps the name. -->
      <span class="hidden sm:inline">{{ 'library.filters.button' | translate }}</span>
      @if (count()) {
        <span class="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 font-mono text-[11px] leading-5 text-white">
          {{ count() }}
        </span>
      }
      @if (customSort()) {
        <span
          class="absolute top-1.5 right-2 size-2 rounded-full bg-gold ring-2 ring-surface md:top-1 md:right-1.5"
          data-sort-dot
          [attr.title]="'library.filters.sortChanged' | translate"
        ></span>
      }
    </button>

    @if (open()) {
      <div class="fixed inset-0 z-40 bg-black/50 md:hidden" (click)="close()" aria-hidden="true"></div>
      <div
        #panel
        role="dialog"
        tabindex="-1"
        [attr.aria-modal]="mobile() || null"
        (keydown)="trapFocus($event)"
        [attr.aria-label]="'library.filters.title' | translate"
        class="fixed inset-x-0 bottom-0 z-50 flex outline-none max-h-[85dvh] animate-modal-in flex-col overflow-y-auto rounded-t-2xl border-t border-border bg-surface px-5 pt-4 pb-[max(env(safe-area-inset-bottom),20px)] md:absolute md:inset-x-auto md:top-full md:right-0 md:bottom-auto md:mt-2 md:max-h-[70vh] md:w-[380px] md:rounded-xl md:border md:p-4 md:shadow-[0_12px_32px_#0006]"
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
          <h3 id="library-filter-sort" class="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
            {{ 'library.sortLabel' | translate }}
          </h3>
          <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="library-filter-sort">
            @for (option of sortChoices; track option) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="sort() === option"
                (click)="sortChange.emit(option)"
                class="rounded-full border px-3 py-1.5 text-[13px]"
                [class]="sort() === option ? 'border-brand-line bg-brand-tint text-text' : 'border-border text-text-2 hover:border-border-strong'"
              >
                {{ 'library.sort.' + option | translate }}
              </button>
            }
          </div>
        </section>

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
                [class]="category() === c ? 'border-brand-line bg-brand-tint text-text' : 'border-border text-text-2 hover:border-border-strong'"
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
                  [class]="isPlatformPicked(p.id) ? 'border-brand-line bg-brand-tint text-text' : 'border-border text-text-2 hover:border-border-strong'"
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
            <p class="text-xs text-faint">{{ 'library.filters.allHint' | translate }}</p>
          </section>
        }

        @if (developerOptions().length) {
          <section class="flex flex-col gap-2 border-t border-divider py-3.5">
            <h3 id="library-filter-developers" class="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
              {{ 'library.filters.developers' | translate }}
            </h3>
            <app-combobox
              multiple
              labelledBy="library-filter-developers"
              [options]="developerOptions()"
              [selected]="developerIds()"
              (selectedChange)="developersChange.emit(namesOf(developers(), $event))"
              placeholder="library.filters.developersPlaceholder"
            />
            <p class="text-xs text-faint">{{ 'library.filters.anyHint' | translate }}</p>
          </section>
        }

        @if (publisherOptions().length) {
          <section class="flex flex-col gap-2 border-t border-divider py-3.5">
            <h3 id="library-filter-publishers" class="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
              {{ 'library.filters.publishers' | translate }}
            </h3>
            <app-combobox
              multiple
              labelledBy="library-filter-publishers"
              [options]="publisherOptions()"
              [selected]="publisherIds()"
              (selectedChange)="publishersChange.emit(namesOf(publishers(), $event))"
              placeholder="library.filters.publishersPlaceholder"
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
            class="press rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-dark"
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
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly collapse = inject(CollapseStateService);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  /** Body overflow before the sheet locked it; null while unlocked. */
  private previousOverflow: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.unlockScroll());
  }

  readonly category = input.required<LibraryCategoryFilter>();
  readonly sort = input<LibrarySort>('recent');
  readonly platformIds = input.required<readonly string[]>();
  readonly genreIds = input.required<readonly number[]>();
  /** Platforms the library's games were played on. */
  readonly platforms = input.required<readonly PlatformRef[]>();
  /** Genres present in the library. */
  readonly genreOptions = input.required<readonly ComboboxOption[]>();
  /** Picked developer / publisher names (spelled as in `developers` / `publishers`). */
  readonly developerNames = input<readonly string[]>([]);
  readonly publisherNames = input<readonly string[]>([]);
  /** Developers / publishers present in the library, sorted. */
  readonly developers = input<readonly string[]>([]);
  readonly publishers = input<readonly string[]>([]);

  readonly categoryChange = output<LibraryCategoryFilter>();
  readonly platformsChange = output<string[]>();
  readonly genresChange = output<readonly number[]>();
  readonly developersChange = output<string[]>();
  readonly publishersChange = output<string[]>();
  readonly sortChange = output<LibrarySort>();
  /** Clears the filters (type, platforms, genres, developers, publishers); the sort stays. */
  readonly cleared = output<void>();

  protected readonly categoryChoices: readonly LibraryCategoryFilter[] = ['ALL', ...GAME_CATEGORIES];
  protected readonly sortChoices = LIBRARY_SORTS;
  /** A sort other than the default: a dot on the button (the count is for filters only). */
  protected readonly customSort = computed(() => this.sort() !== 'recent');
  protected readonly open = signal(false);
  protected readonly count = computed(
    () =>
      (this.category() !== 'ALL' ? 1 : 0) +
      this.platformIds().length +
      this.genreIds().length +
      this.developerNames().length +
      this.publisherNames().length,
  );
  /** The combobox works with numeric ids: a name's id is its index in the (sorted) option list. */
  protected readonly developerOptions = computed(() => nameOptions(this.developers()));
  protected readonly publisherOptions = computed(() => nameOptions(this.publishers()));
  protected readonly developerIds = computed(() => idsOf(this.developers(), this.developerNames()));
  protected readonly publisherIds = computed(() => idsOf(this.publishers(), this.publisherNames()));
  protected readonly namesOf = namesOf;
  protected readonly platformLabel = (name: string): string => platformNameKey(name) ?? name;

  protected isPlatformPicked(id: number): boolean {
    return this.platformIds().includes(String(id));
  }

  protected togglePlatform(id: number): void {
    const key = String(id);
    const current = this.platformIds();
    this.platformsChange.emit(current.includes(key) ? current.filter((p) => p !== key) : [...current, key]);
  }

  /** Below md the panel is a modal bottom sheet: page scroll locked, focus trapped. */
  protected readonly mobile = computed(() => !this.collapse.atLeast('md')());

  protected toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.openPanel();
    }
  }

  private openPanel(): void {
    this.open.set(true);
    if (this.mobile()) this.lockScroll();
    afterNextRender(
      () => {
        const panel = this.panel()?.nativeElement;
        (this.focusables()[0] ?? panel)?.focus?.();
      },
      { injector: this.injector },
    );
  }

  /** Closes the panel; focus goes back to the trigger unless the user moved it elsewhere (outside click). */
  close(restoreFocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    this.unlockScroll();
    if (restoreFocus) this.trigger().nativeElement.focus?.();
  }

  protected onEscape(): void {
    this.close();
  }

  protected onDocumentClick(event: MouseEvent): void {
    // Outside clicks close the desktop popover; the mobile sheet has its own backdrop.
    const target = event.target as Node | null;
    if (this.open() && target && target.isConnected && !this.host.contains(target)) {
      const active = this.document.activeElement;
      // Only take focus back when it was in the panel or nowhere (not when the click focused a field).
      this.close(!active || active === this.document.body || this.host.contains(active));
    }
  }

  protected trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.mobile()) return;
    const items = this.focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = this.document.activeElement;
    if (event.shiftKey && (active === first || active === this.panel()?.nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusables(): HTMLElement[] {
    const panel = this.panel()?.nativeElement;
    return panel
      ? Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'))
      : [];
  }

  private lockScroll(): void {
    if (this.previousOverflow !== null) return;
    const body = this.document.body;
    this.previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
  }

  private unlockScroll(): void {
    if (this.previousOverflow === null) return;
    this.document.body.style.overflow = this.previousOverflow;
    this.previousOverflow = null;
  }
}

function nameOptions(names: readonly string[]): ComboboxOption[] {
  return names.map((label, id) => ({ id, label }));
}

/** Option ids (indexes in `names`) of the picked names; unknown names are skipped. */
export function idsOf(names: readonly string[], picked: readonly string[]): number[] {
  return picked.map((name) => names.indexOf(name)).filter((id) => id >= 0);
}

/** Names behind combobox option ids (indexes in `names`), in pick order. */
export function namesOf(names: readonly string[], ids: readonly number[]): string[] {
  return ids.flatMap((id) => (id >= 0 && id < names.length ? [names[id]] : []));
}
