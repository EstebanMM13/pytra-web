import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { DiaryDay } from '../../core/models/diary.model';
import { Experience } from '../../core/models/experience.model';
import { Game } from '../../core/models/game.model';
import { InProgressExperience } from '../../core/models/stats.model';
import { DemoModeService } from '../../core/services/demo-mode.service';
import { DiaryService } from '../../core/services/diary.service';
import { ExperienceService } from '../../core/services/experience.service';
import { GameService } from '../../core/services/game.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { ToastService } from '../../shared/toast/toast.service';
import { GameCover } from '../../shared/ui/game-cover';
import { ICONS } from '../../shared/ui/icons';
import { ModalSheet } from '../../shared/ui/modal-sheet';
import { toastApiError } from '../../shared/utils/api-error';
import { formatDecimalInput } from '../../shared/utils/decimal-input';
import { ratingLocale } from '../../shared/utils/rating-format';
import { RUN_DATE_MIN, runDateMax } from '../../shared/utils/run-dates';
import { HOUR_STEPS, bumpHoursDraft } from '../games/experience-detail/inline-edit.logic';
import {
  DiaryDraftGame,
  dayLabel,
  draftForGame,
  draftFromDay,
  draftTotal,
  formatDiaryHours,
  isValidDiaryDate,
  parseDiaryHours,
  playingNowGames,
  runErrorIndexes,
  searchLibrary,
  toDayRequest,
} from './diary.logic';

/** Runs a row can be moved to, loaded when the row needs a run chooser. */
type RunOptions = Experience[] | 'loading' | 'error';

/**
 * Editor of one diary day (modal on web, full-screen sheet on mobile): the games played with their
 * hours (+0,5 / +1 steps like the run's inline edit), optional notes, and a run chooser when the API
 * cannot tell which run the hours go to. Saving replaces the whole day.
 */
@Component({
  selector: 'app-diary-day-editor',
  imports: [ModalSheet, TranslatePipe, LucideDynamicIcon, GameCover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-sheet
      [title]="title()"
      [saveLabel]="'diary.editor.save' | translate"
      [saving]="saving()"
      [saveDisabled]="loading()"
      (save)="save()"
      (closed)="closed.emit()"
    >
      <div class="flex flex-col gap-5">
        <label class="flex flex-col gap-1.5 text-sm">
          <span class="text-muted">{{ 'diary.editor.date' | translate }}</span>
          <input
            type="date"
            data-diary-date
            class="rounded-lg border border-border bg-bg px-3 py-2.5 text-[15px] text-text"
            [min]="minDate"
            [max]="maxDate"
            [value]="currentDate()"
            (change)="changeDate($any($event.target).value)"
          />
        </label>

        @if (loading()) {
          <p class="text-sm text-muted" role="status">{{ 'diary.editor.loading' | translate }}</p>
        } @else {
          <!-- Game picker: "playing now" chips and a library search -->
          <div class="flex flex-col gap-2.5">
            @if (chips().length) {
              <p class="text-xs font-medium tracking-[0.06em] text-muted uppercase">
                {{ 'diary.editor.playingNow' | translate }}
              </p>
              <div class="flex flex-wrap gap-2" data-playing-chips>
                @for (chip of chips(); track chip.id) {
                  <button
                    type="button"
                    (click)="addGame(chip)"
                    class="press flex max-w-full items-center gap-1.5 rounded-full border border-brand-line bg-brand-tint px-3 py-1.5 text-[13px] font-medium text-brand-light"
                  >
                    <svg
                      [lucideIcon]="icons.plus"
                      [size]="14"
                      class="shrink-0"
                      aria-hidden="true"
                    ></svg>
                    <span class="truncate">{{ chip.name }}</span>
                  </button>
                }
              </div>
            }
            <label class="sr-only" for="diary-game-search">{{
              'diary.editor.searchLabel' | translate
            }}</label>
            <div class="relative">
              <svg
                [lucideIcon]="icons.search"
                [size]="16"
                class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
                aria-hidden="true"
              ></svg>
              <input
                id="diary-game-search"
                type="search"
                autocomplete="off"
                class="w-full rounded-lg border border-border bg-bg py-2.5 pr-3 pl-9 text-[15px] text-text"
                [placeholder]="'diary.editor.searchPlaceholder' | translate"
                [value]="query()"
                (input)="query.set($any($event.target).value)"
              />
            </div>
            @if (query().trim()) {
              <ul class="flex flex-col rounded-lg border border-border" data-search-results>
                @for (game of results(); track game.id) {
                  <li>
                    <button
                      type="button"
                      (click)="addGame(game)"
                      class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-hover"
                    >
                      <app-game-cover
                        decorative
                        size="xs"
                        [url]="game.coverImageUrl"
                        [name]="game.name"
                      />
                      <span class="min-w-0 flex-1 truncate">{{ game.name }}</span>
                      <svg
                        [lucideIcon]="icons.plus"
                        [size]="16"
                        class="shrink-0 text-brand-light"
                        aria-hidden="true"
                      ></svg>
                    </button>
                  </li>
                } @empty {
                  <li class="px-3 py-2.5 text-sm text-muted">
                    {{ 'diary.editor.noResults' | translate }}
                  </li>
                }
              </ul>
            }
          </div>

          <!-- Games of the day -->
          <div class="flex flex-col gap-3">
            @for (game of games(); track game.gameId; let i = $index) {
              <div
                class="flex flex-col gap-2.5 rounded-xl border border-card-border bg-surface p-3"
                data-diary-row
              >
                <div class="flex items-center gap-3">
                  <app-game-cover
                    decorative
                    size="sm"
                    [url]="game.coverImageUrl"
                    [name]="game.gameName"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[15px] font-medium">{{ game.gameName }}</p>
                    @if (game.synced) {
                      <span
                        class="mt-1 inline-flex items-center gap-1 rounded-full bg-hover px-2 py-0.5 text-[11px] text-text-2"
                        data-synced-tag
                      >
                        <svg [lucideIcon]="icons.refreshCw" [size]="11" aria-hidden="true"></svg>
                        {{ 'diary.syncedTag' | translate }}
                      </span>
                    } @else if (game.category === 'ONLINE') {
                      <p class="truncate text-xs text-muted">
                        {{ 'diary.editor.toOnline' | translate }}
                      </p>
                    } @else if (game.runLabel) {
                      <p class="truncate text-xs text-muted">
                        {{ 'diary.editor.toRun' | translate: { run: game.runLabel } }}
                        @if (!runOptions()[game.gameId]) {
                          <button
                            type="button"
                            class="ml-1 text-brand-light hover:underline"
                            (click)="loadRuns(game.gameId)"
                          >
                            {{ 'diary.editor.changeRun' | translate }}
                          </button>
                        }
                      </p>
                    }
                  </div>
                  <button
                    type="button"
                    (click)="removeGame(i)"
                    class="grid size-10 shrink-0 place-items-center rounded-lg text-faint hover:bg-hover hover:text-text"
                    [attr.aria-label]="'diary.editor.remove' | translate: { name: game.gameName }"
                  >
                    <svg [lucideIcon]="icons.x" [size]="18"></svg>
                  </button>
                </div>

                @if (runOptions()[game.gameId]; as options) {
                  <div
                    class="flex flex-col gap-2 rounded-lg border p-2.5 text-sm"
                    [class]="runMissing().has(game.gameId) ? 'border-danger' : 'border-border'"
                    data-run-chooser
                  >
                    @if (runMissing().has(game.gameId)) {
                      <p class="text-xs text-danger" role="alert">
                        {{ 'diary.editor.runRequired' | translate }}
                      </p>
                    }
                    @if (options === 'loading') {
                      <p class="text-xs text-muted">{{ 'diary.editor.loadingRuns' | translate }}</p>
                    } @else if (options === 'error') {
                      <p class="text-xs text-danger">{{ 'diary.editor.runsError' | translate }}</p>
                    } @else {
                      @if (options.length) {
                        <label class="flex flex-col gap-1">
                          <span class="text-xs text-muted">{{
                            'diary.editor.whichRun' | translate
                          }}</span>
                          <select
                            class="rounded-lg border border-border bg-bg px-3 py-2 text-[15px] text-text"
                            (change)="pickRun(i, $any($event.target).value)"
                          >
                            <option value="" [selected]="game.experienceId === null" disabled>
                              {{ 'diary.editor.pickRun' | translate }}
                            </option>
                            @for (run of options; track run.id) {
                              <option [value]="run.id" [selected]="run.id === game.experienceId">
                                {{ run.runLabel }} · {{ 'status.' + run.status | translate }}
                              </option>
                            }
                          </select>
                        </label>
                      } @else {
                        <p class="text-xs text-muted">{{ 'diary.editor.noRuns' | translate }}</p>
                      }
                      <button
                        type="button"
                        class="self-start text-[13px] font-semibold text-brand-light hover:underline"
                        (click)="newRun(game.gameId)"
                      >
                        + {{ 'diary.editor.newRun' | translate }}
                      </button>
                    }
                  </div>
                }

                <div class="flex flex-col gap-1.5">
                  <div class="flex items-stretch gap-1.5">
                    <input
                      type="text"
                      inputmode="decimal"
                      autocomplete="off"
                      class="min-h-11 w-full min-w-0 flex-[1.4] rounded-lg border bg-bg px-3 font-mono text-lg font-bold text-text"
                      [class]="invalid().has(i) ? 'border-danger' : 'border-border-strong'"
                      [placeholder]="'diary.editor.hoursPlaceholder' | translate"
                      [attr.aria-label]="
                        'diary.editor.hoursLabel' | translate: { name: game.gameName }
                      "
                      [attr.aria-invalid]="invalid().has(i)"
                      [value]="game.hoursText"
                      (input)="setHours(i, $any($event.target).value)"
                    />
                    @for (step of hourSteps; track step) {
                      <button
                        type="button"
                        class="min-h-11 min-w-0 flex-1 rounded-lg border border-brand-line bg-brand-tint font-mono text-[13px] font-semibold text-brand-light hover:bg-brand-tint/80"
                        [attr.aria-label]="
                          'run.inlineAddHours' | translate: { hours: stepLabel(step) }
                        "
                        (mousedown)="$event.preventDefault()"
                        (click)="bump(i, step)"
                      >
                        +{{ stepLabel(step) }}
                      </button>
                    }
                  </div>
                  @if (invalid().has(i)) {
                    <p class="text-xs text-danger">{{ 'diary.editor.hoursError' | translate }}</p>
                  }
                </div>
                <input
                  type="text"
                  maxlength="500"
                  class="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
                  [placeholder]="'diary.editor.gameNote' | translate"
                  [attr.aria-label]="
                    'diary.editor.gameNoteLabel' | translate: { name: game.gameName }
                  "
                  [value]="game.note"
                  (input)="setNote(i, $any($event.target).value)"
                />
              </div>
            } @empty {
              <p
                class="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted"
              >
                {{ 'diary.editor.empty' | translate }}
              </p>
            }
            @if (games().length) {
              <p class="text-right text-sm text-text-3">
                {{ 'diary.editor.total' | translate }}
                <span class="font-mono font-semibold text-text">{{ total() }}</span>
              </p>
            }
          </div>

          <label class="flex flex-col gap-1.5 text-sm">
            <span class="text-muted">{{ 'diary.editor.dayNote' | translate }}</span>
            <textarea
              rows="3"
              maxlength="1000"
              class="rounded-lg border border-border bg-bg px-3 py-2 text-[15px] text-text"
              [placeholder]="'diary.editor.dayNotePlaceholder' | translate"
              [value]="note()"
              (input)="note.set($any($event.target).value)"
            ></textarea>
          </label>

          @if (existing()) {
            <button
              type="button"
              data-delete-day
              (click)="deleteDay()"
              [disabled]="saving()"
              class="flex items-center justify-center gap-2 self-start rounded-lg border border-border px-3.5 py-2 text-[13px] font-semibold text-danger hover:bg-hover disabled:opacity-50"
            >
              <svg [lucideIcon]="icons.trash" [size]="15" aria-hidden="true"></svg>
              {{
                (confirmDelete() ? 'diary.editor.confirmDelete' : 'diary.editor.delete') | translate
              }}
            </button>
          }
        }
      </div>
    </app-modal-sheet>
  `,
})
export class DiaryDayEditor implements OnInit {
  protected readonly icons = ICONS;
  protected readonly hourSteps = HOUR_STEPS;
  protected readonly minDate = RUN_DATE_MIN;
  protected readonly maxDate = runDateMax();

  private readonly diaryService = inject(DiaryService);
  private readonly gameService = inject(GameService);
  private readonly statsService = inject(StatsService);
  private readonly experienceService = inject(ExperienceService);
  private readonly runFormLauncher = inject(RunFormLauncher);
  private readonly demoMode = inject(DemoModeService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  /** Day opened (`yyyy-mm-dd`). */
  readonly date = input.required<string>();
  /** The day was saved (null: it was left empty or deleted) — `date` is the day's date. */
  readonly saved = output<{ date: string; day: DiaryDay | null }>();
  readonly closed = output<void>();

  protected readonly currentDate = signal('');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly existing = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly note = signal('');
  protected readonly games = signal<DiaryDraftGame[]>([]);
  protected readonly query = signal('');
  protected readonly invalid = signal<ReadonlySet<number>>(new Set());
  /** Games the API could not place on a run. */
  protected readonly runMissing = signal<ReadonlySet<number>>(new Set());
  protected readonly runOptions = signal<Record<number, RunOptions>>({});

  private readonly library = signal<Game[]>([]);
  private readonly playing = signal<InProgressExperience[]>([]);
  private readonly lang = computed(() => this.translate.currentLang() ?? 'es');
  private readonly locale = computed(() => ratingLocale(this.lang()));
  /** Game a "new run" was opened for: the created run is picked for it. */
  private newRunFor: number | null = null;

  protected readonly title = computed(() =>
    this.currentDate() ? dayLabel(this.currentDate(), this.locale(), new Date().getFullYear()) : '',
  );
  private readonly pickedIds = computed(() => new Set(this.games().map((g) => g.gameId)));
  protected readonly chips = computed(() => playingNowGames(this.playing(), this.pickedIds()));
  protected readonly results = computed(() =>
    searchLibrary(this.library(), this.query(), this.pickedIds()),
  );
  protected readonly total = computed(() =>
    formatDiaryHours(draftTotal(this.games()), this.locale()),
  );

  constructor() {
    this.gameService
      .findAll()
      .pipe(
        takeUntilDestroyed(),
        catchError(() => of([] as Game[])),
      )
      .subscribe((games) => this.library.set(games));
    this.statsService
      .getInProgress()
      .pipe(
        takeUntilDestroyed(),
        catchError(() => of([] as InProgressExperience[])),
      )
      .subscribe((runs) => this.playing.set(runs));
    this.runFormLauncher.saved$.pipe(takeUntilDestroyed()).subscribe(({ experience, created }) => {
      const gameId = this.newRunFor;
      if (!created || gameId === null || experience.gameId !== gameId) return;
      this.newRunFor = null;
      this.runOptions.update((all) => {
        const current = all[gameId];
        return {
          ...all,
          [gameId]: Array.isArray(current) ? [...current, experience] : [experience],
        };
      });
      this.updateGame(gameId, { experienceId: experience.id, runLabel: experience.runLabel });
    });
  }

  ngOnInit(): void {
    this.load(this.date());
  }

  protected changeDate(value: string): void {
    if (isValidDiaryDate(value) && value !== this.currentDate()) {
      this.load(value);
    }
  }

  protected addGame(
    game: Pick<Game, 'id' | 'name' | 'coverImageUrl'> & { category?: Game['category'] },
  ): void {
    if (this.pickedIds().has(game.id)) return;
    const category =
      game.category ?? this.library().find((g) => g.id === game.id)?.category ?? null;
    this.games.update((games) => [...games, draftForGame({ ...game, category })]);
    this.query.set('');
  }

  protected removeGame(index: number): void {
    const removed = this.games()[index];
    this.games.update((games) => games.filter((_, i) => i !== index));
    this.invalid.set(new Set());
    if (removed) {
      this.runMissing.update((ids) => new Set([...ids].filter((id) => id !== removed.gameId)));
    }
  }

  protected setHours(index: number, text: string): void {
    this.updateAt(index, { hoursText: text });
    if (this.invalid().has(index) && parseDiaryHours(text) !== null) {
      this.invalid.update((set) => new Set([...set].filter((i) => i !== index)));
    }
  }

  protected bump(index: number, step: number): void {
    const game = this.games()[index];
    if (!game) return;
    const next = bumpHoursDraft(game.hoursText, 0, step, this.lang());
    // Never past the daily limit.
    this.setHours(
      index,
      (parseDiaryHours(next) ?? 0) > 0 ? next : formatDecimalInput(24, this.lang()),
    );
  }

  protected setNote(index: number, text: string): void {
    this.updateAt(index, { note: text });
  }

  protected stepLabel(step: number): string {
    return formatDecimalInput(step, this.lang());
  }

  protected loadRuns(gameId: number): void {
    this.runOptions.update((all) => ({ ...all, [gameId]: 'loading' }));
    this.experienceService.findAllByGame(gameId).subscribe({
      next: (runs) => this.runOptions.update((all) => ({ ...all, [gameId]: runs })),
      error: () => this.runOptions.update((all) => ({ ...all, [gameId]: 'error' })),
    });
  }

  protected pickRun(index: number, value: string): void {
    const game = this.games()[index];
    const options = game ? this.runOptions()[game.gameId] : undefined;
    const run = Array.isArray(options) ? options.find((r) => r.id === Number(value)) : undefined;
    if (!game || !run) return;
    this.updateAt(index, { experienceId: run.id, runLabel: run.runLabel });
    this.runMissing.update((ids) => new Set([...ids].filter((id) => id !== game.gameId)));
  }

  protected newRun(gameId: number): void {
    this.newRunFor = gameId;
    this.runFormLauncher.openNewRun(gameId);
  }

  protected save(): void {
    const result = toDayRequest(this.note(), this.games());
    if (!result.ok) {
      this.invalid.set(new Set(result.invalid));
      return;
    }
    const date = this.currentDate();
    this.saving.set(true);
    this.diaryService.saveDay(date, result.request).subscribe({
      next: (day) => {
        this.saving.set(false);
        this.toast.success(
          this.translate.instant(day ? 'diary.toast.saved' : 'diary.toast.deleted'),
        );
        this.saved.emit({ date, day });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const rows = runErrorIndexes(err);
        if (rows) {
          this.showRunChoosers(rows);
          this.toast.error(this.translate.instant('diary.editor.runRequiredToast'));
          return;
        }
        toastApiError(this.toast, this.translate, err, 'diary.toast.saveError');
      },
    });
  }

  protected deleteDay(): void {
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true);
      return;
    }
    if (this.demoMode.blockWrite()) return;
    const date = this.currentDate();
    this.saving.set(true);
    this.diaryService.deleteDay(date).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.translate.instant('diary.toast.deleted'));
        this.saved.emit({ date, day: null });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.confirmDelete.set(false);
        toastApiError(this.toast, this.translate, err, 'diary.toast.deleteError');
      },
    });
  }

  private load(date: string): void {
    this.currentDate.set(date);
    this.loading.set(true);
    this.confirmDelete.set(false);
    this.invalid.set(new Set());
    this.runMissing.set(new Set());
    this.runOptions.set({});
    this.diaryService.findDay(date).subscribe({
      next: (day) => {
        if (date !== this.currentDate()) return;
        this.existing.set(true);
        this.note.set(day.note ?? '');
        this.games.set(draftFromDay(day, this.library(), this.lang()));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        if (date !== this.currentDate()) return;
        this.existing.set(false);
        this.note.set('');
        this.games.set([]);
        this.loading.set(false);
        if (!(err instanceof HttpErrorResponse && err.status === 404)) {
          toastApiError(this.toast, this.translate, err, 'diary.toast.loadError');
        }
      },
    });
  }

  private showRunChoosers(rows: number[]): void {
    const games = this.games();
    const ids = rows.map((i) => games[i]?.gameId).filter((id): id is number => id !== undefined);
    this.runMissing.set(new Set(ids));
    for (const id of ids) {
      if (!Array.isArray(this.runOptions()[id])) this.loadRuns(id);
    }
  }

  private updateAt(index: number, change: Partial<DiaryDraftGame>): void {
    this.games.update((games) => games.map((g, i) => (i === index ? { ...g, ...change } : g)));
  }

  private updateGame(gameId: number, change: Partial<DiaryDraftGame>): void {
    this.games.update((games) => games.map((g) => (g.gameId === gameId ? { ...g, ...change } : g)));
    this.runMissing.update((ids) => new Set([...ids].filter((id) => id !== gameId)));
  }
}
