import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subject, shareReplay } from 'rxjs';
import { NonNullableFormBuilder } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Game } from '../../../core/models/game.model';
import { OnlinePlaytime } from '../../../core/models/online-playtime.model';
import { PlatformRef } from '../../../core/models/platform.model';
import { DemoModeService } from '../../../core/services/demo-mode.service';
import { OnlinePlaytimeService } from '../../../core/services/online-playtime.service';
import { groupPlatformsByFamily, orderPlatformRefsLike } from '../../../core/services/platform.logic';
import { PlatformService } from '../../../core/services/platform.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { toastApiError } from '../../../shared/utils/api-error';
import { burstConfetti } from '../../../shared/utils/confetti';
import { decimalValidator, formatHoursInput, parseDecimal } from '../../../shared/utils/decimal-input';
import { fromRatingScale, isValidTypedRating, scaledRatingDraft } from '../../../shared/utils/rating-scale';
import {
  OnlineFlags,
  OnlinePlaytimeLoadState,
  PlatformHoursInputs,
  PlatformHoursSplit,
  buildOnlinePlaytimeRequest,
  onlineFlagsOf,
  onlinePlaytimeErrorState,
  parsePlatformHours,
  platformHoursInputsOf,
  shouldCelebrateOnline,
  totalWithout,
  unassignedHoursOf,
} from './online-playtime.logic';

/**
 * State and writes of a game's online playtime: the record the page's stats read and the edits of
 * the online card. One instance per GameDetail, which provides it and drives the loading.
 */
@Injectable()
export class OnlinePlaytimeStore {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly onlinePlaytimeService = inject(OnlinePlaytimeService);
  private readonly platformService = inject(PlatformService);
  private readonly preferences = inject(PreferencesService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly demo = inject(DemoModeService);

  /** The game on screen: an answer for any other game is ignored. */
  private readonly gameId = signal(0);
  readonly onlinePlaytime = signal<OnlinePlaytime | null>(null);
  readonly savingOnline = signal(false);
  /** Platforms picked in the online card, in catalog order. */
  readonly onlinePlatforms = signal<PlatformRef[]>([]);
  /** Whether the picker changed since the card loaded (decides if the PUT sends platformIds). */
  private readonly onlinePlatformsTouched = signal(false);
  readonly savingOnlinePlatforms = signal(false);
  /** Per-platform hour inputs of the online card (shown with two or more platforms), by platform id. */
  readonly onlinePlatformHours = signal<PlatformHoursInputs>({});
  /** The per-platform hours failed validation on the last save attempt. */
  readonly onlinePlatformHoursError = signal<PlatformHoursSplit['error']>(null);
  /** Online hours on no platform (typed before platforms existed, or left over): its own editable row. */
  readonly onlineUnassignedHours = signal('');
  /** The online card's platinum / 100% switches: the stored flags, or pending ones before the first save. */
  readonly onlineFlags = signal<OnlineFlags>({ platinum: false, fullCompletion: false });
  readonly savingOnlineFlags = signal(false);
  readonly onlineLoadState = signal<OnlinePlaytimeLoadState>('loading');
  /** Online playtime requested alongside the game (by route id), consumed by the first `loadOnlinePlaytime`. */
  private onlinePrefetch: { id: number; playtime$: Observable<OnlinePlaytime> } | null = null;
  /**
   * Bumped by every local write on this page (game edit, online playtime / platforms). A findById
   * refresh started before a write answers with pre-write data and is ignored.
   */
  localWrites = 0;
  /** The platinum / 100% flags saved on the online playtime, emitted before the record is updated. */
  readonly flagsSaved$ = new Subject<OnlineFlags>();

  // Text inputs so "12,5" works on every keyboard/locale (number inputs drop it as empty).
  readonly onlinePlaytimeForm = this.fb.group({
    // Typed on the rating scale with the run form's rules; stored on 0–10 with two decimals.
    generalRating: this.fb.control(
      '',
      decimalValidator('rating', (r) =>
        isValidTypedRating(
          r,
          this.preferences.ratingScale(),
          this.preferences.ratingPrecision(),
          this.onlinePlaytime()?.generalRating ?? null,
        ),
      ),
    ),
  });

  /** Catalog entries not yet picked for the online card, grouped by family; null while loading. */
  readonly onlinePlatformGroups = computed(() => {
    const catalog = this.platformService.platforms();
    if (!catalog) {
      return null;
    }
    const picked = new Set(this.onlinePlatforms().map((p) => p.id));
    return groupPlatformsByFamily(catalog.filter((p) => !picked.has(p.id)));
  });

  /** New game on the page: requests its online playtime alongside the game. */
  prefetch(id: number): void {
    this.gameId.set(id);
    this.onlinePlaytime.set(null);
    const playtime$ = this.onlinePlaytimeService.findByGame(id).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    playtime$.subscribe({ error: () => {} });
    this.onlinePrefetch = { id, playtime$ };
  }

  load(game: Game): void {
    // The prefetched answer serves the first call for that game only; later calls (after an edit) refetch.
    const prefetch = this.onlinePrefetch?.id === game.id ? this.onlinePrefetch.playtime$ : null;
    this.onlinePrefetch = null;
    // Online hours only exist for ONLINE/HYBRID games; a SINGLEPLAYER game never has them.
    // Also drop hours loaded earlier, e.g. when an edit turns the game into SINGLEPLAYER.
    this.onlinePlaytime.set(null);
    this.onlinePlatforms.set([]);
    this.onlinePlatformHours.set({});
    this.onlinePlatformHoursError.set(null);
    this.onlinePlatformsTouched.set(false);
    this.onlineFlags.set(onlineFlagsOf(null));
    this.onlineLoadState.set('loading');
    if (game.category === 'SINGLEPLAYER') {
      return;
    }
    this.onlinePlaytimeForm.reset({ generalRating: '' });
    // Catalog for the online platform picker (cached after the first load).
    this.platformService.load().subscribe({ error: () => {} });
    const id = game.id;
    (prefetch ?? this.onlinePlaytimeService.findByGame(id)).subscribe({
      next: (playtime) => {
        if (id !== this.gameId()) return;
        const lang = this.lang();
        this.onlinePlaytime.set(playtime);
        this.onlinePlatforms.set(playtime.platforms ?? []);
        this.onlinePlatformHours.set(
          platformHoursInputsOf(playtime, (playtime.platforms ?? []).map((p) => p.id), lang),
        );
        const unassigned = unassignedHoursOf(playtime);
        this.onlineUnassignedHours.set(unassigned > 0 ? formatHoursInput(unassigned, lang) : '');
        this.onlineFlags.set(onlineFlagsOf(playtime));
        this.onlineLoadState.set('loaded');
        this.onlinePlaytimeForm.setValue({
          generalRating: scaledRatingDraft(playtime.generalRating, this.preferences.ratingScale(), lang),
        });
      },
      error: (error: unknown) => {
        // 404: no online hours recorded for this game yet. Anything else: saving could overwrite
        // a record we failed to read, so the card is disabled.
        if (id === this.gameId()) this.onlineLoadState.set(onlinePlaytimeErrorState(error));
      },
    });
  }

  /** The typed online rating on the stored 0–10 scale; empty (or invalid, blocked earlier) is null. */
  private storedOnlineRating(text: string): number | null {
    const value = parseDecimal(text);
    return value === null || Number.isNaN(value) ? null : fromRatingScale(value, this.preferences.ratingScale());
  }

  private lang(): string {
    return this.translate.currentLang() === 'en' ? 'en' : 'es';
  }

  /** Picks a catalog platform from the online card's select, then resets the select to its prompt. */
  addOnlinePlatform(select: HTMLSelectElement): void {
    const id = Number(select.value);
    select.value = '';
    const catalog = this.platformService.platforms() ?? [];
    const platform = catalog.find((p) => p.id === id);
    if (!platform || this.onlinePlatforms().some((p) => p.id === id)) {
      return;
    }
    this.changeOnlinePlatforms(
      orderPlatformRefsLike(
        [...this.onlinePlatforms(), { id: platform.id, name: platform.name, color: platform.color }],
        catalog,
      ),
    );
  }

  removeOnlinePlatform(id: number): void {
    this.changeOnlinePlatforms(this.onlinePlatforms().filter((p) => p.id !== id));
  }

  /**
   * With a stored record the change is saved right away (reverted if that fails); without one the
   * platforms stay pending and are sent with the first save of the hours.
   */
  private changeOnlinePlatforms(next: PlatformRef[]): void {
    if (this.savingOnlinePlatforms() || this.onlineLoadState() === 'error') {
      return;
    }
    const previous = this.onlinePlatforms();
    this.onlinePlatforms.set(next);
    // Keep what was typed for the platforms that stay; new ones start blank.
    this.onlinePlatformHours.update((inputs) => Object.fromEntries(next.map((p) => [p.id, inputs[p.id] ?? ''])));
    this.onlinePlatformsTouched.set(true);
    const existing = this.onlinePlaytime();
    if (!existing) {
      return;
    }
    const id = this.gameId();
    this.savingOnlinePlatforms.set(true);
    this.onlinePlaytimeService
      .upsert(
        id,
        // The stored hours and rating, not the form's possibly unsaved edits.
        buildOnlinePlaytimeRequest({
          totalHours: totalWithout(existing, next.map((p) => p.id)),
          generalRating: existing.generalRating,
          existing,
          platformIds: next.map((p) => p.id),
          platformsTouched: true,
          // The switches, not the stored flags: a flag save may still be in flight.
          ...this.onlineFlags(),
        }),
      )
      .subscribe({
        next: (playtime) => {
          this.savingOnlinePlatforms.set(false);
          if (id !== this.gameId()) return;
          this.localWrites++;
          this.onlinePlaytime.set(playtime);
          this.onlinePlatforms.set(playtime.platforms ?? []);
          this.toast.success(this.translate.instant('game.online.saved'));
        },
        error: (err: unknown) => {
          this.savingOnlinePlatforms.set(false);
          if (id === this.gameId()) this.onlinePlatforms.set(previous);
          toastApiError(this.toast, this.translate, err, 'game.online.error');
        },
      });
  }

  /**
   * Flips a platinum / 100% switch of the online card. With a stored record the change is saved right
   * away, like the platforms (reverted if that fails); without one it stays pending and is sent with
   * the first save of the hours.
   */
  toggleOnlineFlag(flag: keyof OnlineFlags): void {
    if (this.savingOnlineFlags() || this.onlineLoadState() === 'error' || this.onlineLoadState() === 'loading') {
      return;
    }
    const previous = this.onlineFlags();
    const next: OnlineFlags = { ...previous, [flag]: !previous[flag] };
    this.onlineFlags.set(next);
    const existing = this.onlinePlaytime();
    if (!existing) {
      return;
    }
    const id = this.gameId();
    this.savingOnlineFlags.set(true);
    this.onlinePlaytimeService
      .upsert(
        id,
        // The stored hours and rating, not the form's possibly unsaved edits; the picked platforms,
        // which a record saves right away (one of those saves may still be in flight).
        buildOnlinePlaytimeRequest({
          totalHours: existing.totalHours,
          generalRating: existing.generalRating,
          existing,
          platformIds: this.onlinePlatforms().map((p) => p.id),
          platformsTouched: false,
          ...next,
        }),
      )
      .subscribe({
        next: (playtime) => {
          this.savingOnlineFlags.set(false);
          if (id !== this.gameId()) return;
          this.onOnlineFlagsSaved(playtime, onlineFlagsOf(existing));
          this.onlinePlaytime.set(playtime);
          this.toast.success(this.translate.instant('game.online.saved'));
        },
        error: (err: unknown) => {
          this.savingOnlineFlags.set(false);
          if (id === this.gameId()) this.onlineFlags.set(previous);
          toastApiError(this.toast, this.translate, err, 'game.online.error');
        },
      });
  }

  /**
   * After an online save: syncs the switches, celebrates a newly reached flag and announces the flags,
   * so the page can refresh the game's hasPlatinum / hasFullCompletion.
   */
  private onOnlineFlagsSaved(playtime: OnlinePlaytime, previous: OnlineFlags): void {
    this.localWrites++;
    const saved = onlineFlagsOf(playtime);
    this.onlineFlags.set(saved);
    if (shouldCelebrateOnline(saved, previous, this.demo.isDemo())) {
      burstConfetti();
    }
    this.flagsSaved$.next(saved);
  }

  setOnlinePlatformHours(platformId: number, text: string): void {
    this.onlinePlatformHours.update((inputs) => ({ ...inputs, [platformId]: text }));
    this.onlinePlatformHoursError.set(null);
  }

  setOnlineUnassignedHours(text: string): void {
    this.onlineUnassignedHours.set(text);
    this.onlinePlatformHoursError.set(null);
  }

  /** The unassigned row shows while there are hours on no platform (stored or typed). */
  showUnassignedRow(): boolean {
    return this.onlineUnassignedHours().trim() !== '' || unassignedHoursOf(this.onlinePlaytime()) > 0;
  }

  /**
   * The hours of each platform plus the unassigned row; their sum is the online total (`assigned`).
   * Null without platforms.
   */
  onlinePlatformSplit(): PlatformHoursSplit | null {
    const ids = this.onlinePlatforms().map((p) => p.id);
    if (!ids.length) return null;
    const UNASSIGNED = -1;
    const split = parsePlatformHours(
      { ...this.onlinePlatformHours(), [UNASSIGNED]: this.onlineUnassignedHours() },
      [...ids, UNASSIGNED],
      Number.MAX_SAFE_INTEGER,
    );
    const { [UNASSIGNED]: unassigned = 0, ...hours } = split.hours;
    return { ...split, hours, unassigned, over: 0 };
  }

  submitOnlinePlaytime(): void {
    if (this.onlinePlaytimeForm.invalid || this.savingOnline() || this.onlineLoadState() === 'error') {
      this.onlinePlaytimeForm.markAllAsTouched();
      return;
    }
    const split = this.onlinePlatformSplit();
    if (split?.error) {
      this.onlinePlatformHoursError.set(split.error);
      return;
    }
    const raw = this.onlinePlaytimeForm.getRawValue();
    const id = this.gameId();
    // Pending switches (no record yet) are saved here: the stored flags are the baseline.
    const previousFlags = onlineFlagsOf(this.onlinePlaytime());
    this.savingOnline.set(true);
    this.onlinePlaytimeService
      .upsert(
        id,
        buildOnlinePlaytimeRequest({
          // The total is the platforms' hours plus the unassigned row; without platforms it is kept.
          totalHours: split ? split.assigned : (this.onlinePlaytime()?.totalHours ?? 0),
          generalRating: this.storedOnlineRating(raw.generalRating),
          existing: this.onlinePlaytime(),
          platformIds: this.onlinePlatforms().map((p) => p.id),
          platformsTouched: this.onlinePlatformsTouched(),
          ...this.onlineFlags(),
          platformHours: split?.hours,
        }),
      )
      .subscribe({
        next: (playtime) => {
          this.savingOnline.set(false);
          if (id !== this.gameId()) return;
          this.onOnlineFlagsSaved(playtime, previousFlags);
          this.onlinePlaytime.set(playtime);
          this.onlinePlatforms.set(playtime.platforms ?? []);
          this.onlineLoadState.set('loaded');
          this.toast.success(this.translate.instant('game.online.saved'));
        },
        error: (err: unknown) => {
          this.savingOnline.set(false);
          toastApiError(this.toast, this.translate, err, 'game.online.error');
        },
      });
  }
}
