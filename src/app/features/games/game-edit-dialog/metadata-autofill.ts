import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS } from '../../../shared/ui/icons';
import { TranslatePipe } from '@ngx-translate/core';
import {
  Observable,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { IgdbMetadataService } from '../../../core/services/igdb-metadata.service';
import { SteamMetadataService } from '../../../core/services/steam-metadata.service';
import { GameCover } from '../../../shared/ui/game-cover';
import { Segmented, SegmentedOption } from '../../../shared/ui/segmented';
import {
  AUTOFILL_SEARCH_MIN_LENGTH,
  AUTOFILL_SOURCE_LABELS,
  AutofillMetadata,
  AutofillPick,
  AutofillResult,
  AutofillSource,
  autofillErrorKey,
  fromIgdbResult,
  fromSteamResult,
  resultDetails,
} from './metadata-autofill.logic';

/** Debounce for the search: the source is called through the API, not on every keystroke. */
export const AUTOFILL_SEARCH_DEBOUNCE_MS = 350;

type SearchState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Inline game search for the game form, on IGDB (covers console exclusives) or the Steam store: type,
 * pick a result (mouse or arrows + Enter) and it emits that game's normalized metadata. It never
 * saves anything; the parent fills its form.
 */
@Component({
  selector: 'app-metadata-autofill',
  imports: [TranslatePipe, Segmented, GameCover, LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2 rounded-xl border border-border bg-bg p-3">
      @if (igdbEnabled()) {
        <app-segmented
          size="sm"
          tone="neutral"
          [options]="sourceOptions"
          [value]="source()"
          (valueChange)="setSource($event)"
          [attr.aria-label]="'game.autofill.source' | translate"
          class="self-start"
        />
      }
      <div class="flex items-center gap-2">
        <div class="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3">
          <svg [lucideIcon]="icons.search" [size]="16" class="shrink-0 text-muted"></svg>
          <input
            #queryInput
            id="autofill-query"
            type="text"
            role="combobox"
            autocomplete="off"
            spellcheck="false"
            aria-autocomplete="list"
            aria-controls="autofill-list"
            aria-describedby="autofill-status"
            [attr.aria-expanded]="results().length > 0"
            [attr.aria-activedescendant]="results().length ? 'autofill-option-' + activeIndex() : null"
            [attr.aria-label]="'game.autofill.searchLabel' | translate: sourceParams()"
            [placeholder]="'game.autofill.placeholder' | translate: sourceParams()"
            [value]="query()"
            (input)="onQuery($any($event.target).value)"
            (keydown)="onKeydown($event)"
            class="h-11 min-w-0 flex-1 border-0 bg-transparent text-base text-text focus:shadow-none md:h-10 md:text-[15px]"
          />
        </div>
        <button
          type="button"
          (click)="cancelled.emit()"
          [attr.aria-label]="'game.autofill.close' | translate"
          class="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:text-text"
        >
          <svg [lucideIcon]="icons.x" [size]="18"></svg>
        </button>
      </div>

      <p id="autofill-status" aria-live="polite" class="px-1 text-xs" [class]="errorKey() ? 'text-danger' : 'text-muted'">
        @if (errorKey(); as key) {
          {{ key | translate: sourceParams() }}
        } @else if (loadingId() !== null) {
          {{ 'game.autofill.loadingDetails' | translate }}
        } @else if (state() === 'loading') {
          {{ 'game.autofill.searching' | translate: sourceParams() }}
        } @else if (state() === 'ready' && results().length === 0) {
          {{ 'game.autofill.empty' | translate: sourceParams() }}
        } @else if (state() === 'idle') {
          {{ 'game.autofill.hint' | translate }}
        }
      </p>

      @if (results().length) {
        <ul
          id="autofill-list"
          role="listbox"
          [attr.aria-label]="'game.autofill.results' | translate: sourceParams()"
          (mousedown)="$event.preventDefault()"
          class="scroll-thin flex max-h-64 flex-col overflow-y-auto"
        >
          @for (result of results(); track result.id; let i = $index) {
            <li
              [id]="'autofill-option-' + i"
              role="option"
              [attr.aria-selected]="i === activeIndex()"
              (click)="pick(result)"
              (mousemove)="activeIndex.set(i)"
              class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm"
              [class.bg-brand-tint]="i === activeIndex()"
            >
              <!-- Box art: IGDB's small cover, or the Steam library capsule the game would be saved with. -->
              <app-game-cover decorative size="sm" [url]="result.imageUrl" [name]="result.name" />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate" [class]="i === activeIndex() ? 'text-brand-lighter' : 'text-text-2'">
                  {{ result.name }}
                </span>
                @if (details(result); as line) {
                  <span class="truncate text-xs text-muted">{{ line }}</span>
                }
              </span>
              @if (loadingId() === result.id) {
                <svg [lucideIcon]="icons.loaderCircle" [size]="16" class="shrink-0 animate-spin text-muted"></svg>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class MetadataAutofill implements OnInit {
  protected readonly icons = ICONS;

  /** Whether the API offers IGDB; when it does it is the default source and a switch shows Steam too. */
  readonly igdbEnabled = input(false);
  /** Metadata of the picked game, ready to prefill the form. */
  readonly picked = output<AutofillPick>();
  readonly cancelled = output<void>();

  private readonly igdbService = inject(IgdbMetadataService);
  private readonly steamService = inject(SteamMetadataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queries = new Subject<{ source: AutofillSource; query: string; force?: boolean }>();
  private detailsSubscription: Subscription | null = null;
  private readonly queryInput = viewChild.required<ElementRef<HTMLInputElement>>('queryInput');

  protected readonly sourceOptions: SegmentedOption<AutofillSource>[] = [
    { value: 'igdb', label: AUTOFILL_SOURCE_LABELS.igdb },
    { value: 'steam', label: AUTOFILL_SOURCE_LABELS.steam },
  ];
  /** Source picked with the switch; null = the default for the current providers. */
  private readonly chosenSource = signal<AutofillSource | null>(null);
  protected readonly source = computed<AutofillSource>(() =>
    this.igdbEnabled() ? (this.chosenSource() ?? 'igdb') : 'steam',
  );
  protected readonly sourceParams = computed(() => ({ source: AUTOFILL_SOURCE_LABELS[this.source()] }));

  protected readonly query = signal('');
  protected readonly results = signal<AutofillResult[]>([]);
  protected readonly state = signal<SearchState>('idle');
  protected readonly activeIndex = signal(0);
  protected readonly loadingId = signal<number | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly details = resultDetails;

  constructor() {
    afterNextRender(() => this.queryInput().nativeElement.focus());
  }

  ngOnInit(): void {
    this.queries
      .pipe(
        map(({ source, query, force }) => ({ source, query: query.trim(), force })),
        debounceTime(AUTOFILL_SEARCH_DEBOUNCE_MS),
        // A source switch always searches again: its results were cleared even if the query is the same.
        distinctUntilChanged((a, b) => !b.force && a.source === b.source && a.query === b.query),
        tap(({ query }) => {
          this.errorKey.set(null);
          this.state.set(query.length >= AUTOFILL_SEARCH_MIN_LENGTH ? 'loading' : 'idle');
          if (query.length < AUTOFILL_SEARCH_MIN_LENGTH) {
            this.results.set([]);
          }
        }),
        switchMap(({ source, query }) => {
          if (query.length < AUTOFILL_SEARCH_MIN_LENGTH) {
            return of(null);
          }
          return this.search(source, query).pipe(
            catchError((err: unknown) => {
              this.errorKey.set(autofillErrorKey(err));
              return of([] as AutofillResult[]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((results) => {
        if (results === null) {
          return;
        }
        this.results.set(results);
        this.activeIndex.set(0);
        this.state.set(this.errorKey() ? 'error' : 'ready');
      });
    this.destroyRef.onDestroy(() => this.detailsSubscription?.unsubscribe());
  }

  protected setSource(source: AutofillSource): void {
    if (source === this.source()) {
      return;
    }
    this.chosenSource.set(source);
    // Results and a pending pick belong to the old source.
    this.detailsSubscription?.unsubscribe();
    this.loadingId.set(null);
    this.results.set([]);
    this.errorKey.set(null);
    this.queries.next({ source, query: this.query(), force: true });
    this.queryInput().nativeElement.focus();
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.queries.next({ source: this.source(), query: value });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      this.activeIndex.update((i) => (i + 1) % count);
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      this.activeIndex.update((i) => (i - 1 + count) % count);
    } else if (event.key === 'Enter') {
      // Never submit the surrounding game form from the search box.
      event.preventDefault();
      const result = this.results()[this.activeIndex()];
      if (result) {
        this.pick(result);
      }
    } else if (event.key === 'Escape') {
      // Close the search only; the dialog ignores an Escape that was already handled.
      event.preventDefault();
      this.cancelled.emit();
    }
  }

  protected pick(result: AutofillResult): void {
    if (this.loadingId() !== null) {
      return;
    }
    const source = this.source();
    this.errorKey.set(null);
    this.loadingId.set(result.id);
    this.detailsSubscription = this.details$(source, result.id).subscribe({
      next: (metadata) => {
        this.loadingId.set(null);
        this.picked.emit({ source, metadata });
      },
      error: (err: unknown) => {
        this.loadingId.set(null);
        this.errorKey.set(autofillErrorKey(err));
      },
    });
  }

  private search(source: AutofillSource, query: string): Observable<AutofillResult[]> {
    return source === 'igdb'
      ? this.igdbService.search(query).pipe(map((hits) => hits.map(fromIgdbResult)))
      : this.steamService.search(query).pipe(map((hits) => hits.map(fromSteamResult)));
  }

  private details$(source: AutofillSource, id: number): Observable<AutofillMetadata> {
    return source === 'igdb' ? this.igdbService.getDetails(id) : this.steamService.getDetails(id);
  }
}
