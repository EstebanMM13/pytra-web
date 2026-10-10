import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideLoaderCircle, LucideSearch, LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { SteamGameMetadata, SteamStoreSearchResult } from '../../../core/models/steam-metadata.model';
import { SteamMetadataService } from '../../../core/services/steam-metadata.service';
import { STEAM_SEARCH_MIN_LENGTH, steamAutofillErrorKey } from './steam-autofill.logic';

/** Debounce for the store search: Steam is called through the API, not on every keystroke. */
export const STEAM_SEARCH_DEBOUNCE_MS = 350;

type SearchState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Inline Steam store search for the game form: type, pick a result (mouse or arrows + Enter) and it
 * emits that game's normalized metadata. It never saves anything; the parent fills its form.
 */
@Component({
  selector: 'app-steam-autofill',
  imports: [TranslatePipe, LucideSearch, LucideX, LucideLoaderCircle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2 rounded-xl border border-border bg-bg p-3">
      <div class="flex items-center gap-2">
        <div class="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3">
          <svg lucideSearch [size]="16" class="shrink-0 text-muted"></svg>
          <input
            #queryInput
            id="steam-autofill-query"
            type="text"
            role="combobox"
            autocomplete="off"
            spellcheck="false"
            aria-autocomplete="list"
            aria-controls="steam-autofill-list"
            aria-describedby="steam-autofill-status"
            [attr.aria-expanded]="results().length > 0"
            [attr.aria-activedescendant]="results().length ? 'steam-autofill-option-' + activeIndex() : null"
            [attr.aria-label]="'game.steamAutofill.searchLabel' | translate"
            [placeholder]="'game.steamAutofill.placeholder' | translate"
            [value]="query()"
            (input)="onQuery($any($event.target).value)"
            (keydown)="onKeydown($event)"
            class="h-11 min-w-0 flex-1 border-0 bg-transparent text-base text-text focus:shadow-none md:h-10 md:text-[15px]"
          />
        </div>
        <button
          type="button"
          (click)="cancelled.emit()"
          [attr.aria-label]="'game.steamAutofill.close' | translate"
          class="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:text-text"
        >
          <svg lucideX [size]="18"></svg>
        </button>
      </div>

      <p id="steam-autofill-status" aria-live="polite" class="px-1 text-xs" [class]="errorKey() ? 'text-danger' : 'text-muted'">
        @if (errorKey(); as key) {
          {{ key | translate }}
        } @else if (loadingAppId() !== null) {
          {{ 'game.steamAutofill.loadingDetails' | translate }}
        } @else if (state() === 'loading') {
          {{ 'game.steamAutofill.searching' | translate }}
        } @else if (state() === 'ready' && results().length === 0) {
          {{ 'game.steamAutofill.empty' | translate }}
        } @else if (state() === 'idle') {
          {{ 'game.steamAutofill.hint' | translate }}
        }
      </p>

      @if (results().length) {
        <ul
          id="steam-autofill-list"
          role="listbox"
          [attr.aria-label]="'game.steamAutofill.results' | translate"
          (mousedown)="$event.preventDefault()"
          class="scroll-thin flex max-h-64 flex-col overflow-y-auto"
        >
          @for (result of results(); track result.appId; let i = $index) {
            <li
              [id]="'steam-autofill-option-' + i"
              role="option"
              [attr.aria-selected]="i === activeIndex()"
              (click)="pick(result)"
              (mousemove)="activeIndex.set(i)"
              class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm"
              [class.bg-brand-tint]="i === activeIndex()"
            >
              @if (result.imageUrl) {
                <img
                  [src]="result.imageUrl"
                  alt=""
                  width="64"
                  height="24"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  class="h-6 w-16 shrink-0 rounded object-cover"
                />
              } @else {
                <span class="h-6 w-16 shrink-0 rounded bg-border"></span>
              }
              <span class="min-w-0 flex-1 truncate" [class]="i === activeIndex() ? 'text-brand-lighter' : 'text-text-2'">
                {{ result.name }}
              </span>
              @if (loadingAppId() === result.appId) {
                <svg lucideLoaderCircle [size]="16" class="shrink-0 animate-spin text-muted"></svg>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class SteamAutofill implements OnInit {
  /** Metadata of the picked game, ready to prefill the form. */
  readonly picked = output<SteamGameMetadata>();
  readonly cancelled = output<void>();

  private readonly metadataService = inject(SteamMetadataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queries = new Subject<string>();
  private detailsSubscription: Subscription | null = null;
  private readonly queryInput = viewChild.required<ElementRef<HTMLInputElement>>('queryInput');

  protected readonly query = signal('');
  protected readonly results = signal<SteamStoreSearchResult[]>([]);
  protected readonly state = signal<SearchState>('idle');
  protected readonly activeIndex = signal(0);
  protected readonly loadingAppId = signal<number | null>(null);
  protected readonly errorKey = signal<string | null>(null);

  constructor() {
    afterNextRender(() => this.queryInput().nativeElement.focus());
  }

  ngOnInit(): void {
    this.queries
      .pipe(
        map((q) => q.trim()),
        debounceTime(STEAM_SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        tap((q) => {
          this.errorKey.set(null);
          this.state.set(q.length >= STEAM_SEARCH_MIN_LENGTH ? 'loading' : 'idle');
          if (q.length < STEAM_SEARCH_MIN_LENGTH) {
            this.results.set([]);
          }
        }),
        switchMap((q) => {
          if (q.length < STEAM_SEARCH_MIN_LENGTH) {
            return of(null);
          }
          return this.metadataService.search(q).pipe(
            catchError((err: unknown) => {
              this.errorKey.set(steamAutofillErrorKey(err));
              return of([] as SteamStoreSearchResult[]);
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

  protected onQuery(value: string): void {
    this.query.set(value);
    this.queries.next(value);
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

  protected pick(result: SteamStoreSearchResult): void {
    if (this.loadingAppId() !== null) {
      return;
    }
    this.errorKey.set(null);
    this.loadingAppId.set(result.appId);
    this.detailsSubscription = this.metadataService.getDetails(result.appId).subscribe({
      next: (metadata) => {
        this.loadingAppId.set(null);
        this.picked.emit(metadata);
      },
      error: (err: unknown) => {
        this.loadingAppId.set(null);
        this.errorKey.set(steamAutofillErrorKey(err));
      },
    });
  }
}
