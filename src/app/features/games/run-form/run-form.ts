import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationStart, Router } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS } from '../../../shared/ui/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, filter, map, startWith } from 'rxjs';
import { Experience, ExperienceStatus } from '../../../core/models/experience.model';
import { Game } from '../../../core/models/game.model';
import { PLATFORM_NAME_MAX_LENGTH, Platform } from '../../../core/models/platform.model';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import {
  findPlatformByKey,
  groupPlatformsByFamily,
  isValidPlatformName,
  normalizePlatformName,
  platformNameKey,
} from '../../../core/services/platform.logic';
import { PlatformService } from '../../../core/services/platform.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { RunFormLauncher, RunFormRequest } from '../../../core/services/run-form-launcher.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { ModalSheet } from '../../../shared/ui/modal-sheet';
import { Segmented, SegmentedOption } from '../../../shared/ui/segmented';
import { Skeleton } from '../../../shared/ui/skeleton';
import { todayIso } from '../../../shared/utils/run-dates';
import { formatDecimalInput } from '../../../shared/utils/decimal-input';
import { toastApiError } from '../../../shared/utils/api-error';
import {
  RUN_STATUSES,
  RunFormValue,
  buildExperienceRequest,
  dateRangeValidator,
  hoursValidator,
  nextRunLabel,
  canStartRun,
  ratingValidatorFor,
  statusForEndDate,
} from './run-form.logic';

const MAX_RESULTS = 8;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Create/edit form for a run (experience). Opened through `RunFormLauncher` and rendered at the
 * app root: modal on web, full-screen sheet on mobile (see `ModalSheet`).
 */
@Component({
  selector: 'app-run-form',
  imports: [ReactiveFormsModule, TranslatePipe, ModalSheet, Segmented, Skeleton, LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './run-form.html',
  styleUrl: './run-form.css',
})
export class RunForm implements OnInit {
  protected readonly icons = ICONS;

  readonly request = input.required<RunFormRequest>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly gameService = inject(GameService);
  private readonly experienceService = inject(ExperienceService);
  private readonly platformService = inject(PlatformService);
  private readonly launcher = inject(RunFormLauncher);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  protected readonly preferences = inject(PreferencesService);

  private lang(): string {
    return this.translate.currentLang() === 'en' ? 'en' : 'es';
  }

  /** Catalog grouped by family; null while loading. */
  protected readonly platformGroups = computed(() => {
    const platforms = this.platformService.platforms();
    return platforms ? groupPlatformsByFamily(platforms) : null;
  });
  protected readonly platformNameMaxLength = PLATFORM_NAME_MAX_LENGTH;
  /** Translation key for seeded names that have one, else the name itself (renders as-is). */
  protected readonly platformLabel = (name: string): string => platformNameKey(name) ?? name;

  // Inline "+ Add platform".
  protected readonly addingPlatform = signal(false);
  protected readonly newPlatformName = signal('');
  protected readonly creatingPlatform = signal(false);
  private readonly newPlatformTouched = signal(false);
  protected readonly newPlatformInvalid = computed(
    () => this.newPlatformTouched() && !isValidPlatformName(this.newPlatformName()),
  );
  protected readonly statusOptions: SegmentedOption<ExperienceStatus>[] = RUN_STATUSES.map((s) => ({
    value: s,
    label: `status.${s}`,
  }));

  readonly form = this.fb.group(
    {
      gameId: this.fb.control<number | null>(null, Validators.required),
      runLabel: this.fb.control('', [Validators.required, Validators.pattern(/\S/)]),
      status: this.fb.control<ExperienceStatus>('EN_CURSO'),
      platformId: this.fb.control<number | null>(null, Validators.required),
      startDate: this.fb.control(''),
      endDate: this.fb.control(''),
      // Text inputs so "9,25" works on every keyboard/locale (number inputs drop it as empty).
      hours: this.fb.control('', hoursValidator),
      rating: this.fb.control(
        '',
        ratingValidatorFor(
          () => this.preferences.ratingPrecision(),
          () => this.original?.rating ?? null,
        ),
      ),
      summary: this.fb.control(''),
      platinum: this.fb.control(false),
      replay: this.fb.control(false),
      pros: this.fb.control(''),
      cons: this.fb.control(''),
      notes: this.fb.control(''),
    },
    { validators: dateRangeValidator },
  );

  private controlSignal<T>(source: Observable<unknown>, read: () => T) {
    return toSignal(source.pipe(startWith(null), map(read)), { initialValue: read() });
  }

  protected readonly status = this.controlSignal(this.form.controls.status.valueChanges, () => this.form.controls.status.value);
  protected readonly platformId = this.controlSignal(
    this.form.controls.platformId.valueChanges,
    () => this.form.controls.platformId.value,
  );
  protected readonly selectedPlatformColor = computed(() => {
    const id = this.platformId();
    return this.platformService.platforms()?.find((p) => p.id === id)?.color ?? null;
  });
  protected readonly platinum = this.controlSignal(this.form.controls.platinum.valueChanges, () => this.form.controls.platinum.value);
  protected readonly replay = this.controlSignal(this.form.controls.replay.valueChanges, () => this.form.controls.replay.value);

  protected readonly isEdit = computed(() => this.request().mode === 'edit');
  protected readonly saving = signal(false);
  protected readonly showMore = signal(false);
  protected readonly endSuggested = signal(false);
  protected readonly submitted = signal(false);

  /** Game shown read-only: preselected from a game page, or the run's game when editing. */
  protected readonly lockedGame = signal<Game | null>(null);
  protected readonly locked = signal(false);

  // Autocomplete state (unlocked "create" mode only).
  protected readonly games = signal<Game[] | null>(null);
  protected readonly query = signal('');
  protected readonly listOpen = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly selectedGame = signal<Game | null>(null);

  protected readonly results = computed(() => {
    const games = this.games() ?? [];
    const query = normalize(this.query().trim());
    const matches = query ? games.filter((g) => normalize(g.name).includes(query)) : games;
    return matches.slice(0, MAX_RESULTS);
  });

  private original: Experience | null = null;

  constructor() {
    // Leaving the page (back button, links) closes the form instead of floating over the next view.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.close());
  }

  ngOnInit(): void {
    const request = this.request();
    const preferredPlatform = request.mode === 'create' ? (request.prefill?.platform ?? this.preferences.defaultPlatform()) : null;
    const editedPlatformId = request.mode === 'edit' ? request.experience.platformId : null;
    const cached = this.platformService.platforms();
    const stale = editedPlatformId !== null && !!cached && !cached.some((p) => p.id === editedPlatformId);
    this.platformService.load(stale).subscribe({
      next: (platforms) => {
        const control = this.form.controls.platformId;
        if (control.value === null && preferredPlatform !== null) {
          // Unknown preference (e.g. a removed id): fall back to PC rather than leaving it empty.
          const platform = findPlatformByKey(platforms, preferredPlatform) ?? findPlatformByKey(platforms, 'PC');
          control.setValue(platform?.id ?? null);
        }
      },
      error: (err: unknown) => toastApiError(this.toast, this.translate, err, 'runForm.platformLoadError'),
    });
    if (request.mode === 'edit') {
      this.initEdit(request.experience);
    } else {
      this.form.patchValue({
        hours: formatDecimalInput(request.prefill?.hours ?? null, this.lang()),
      });
      if (request.gameId !== undefined) {
        this.lockToGame(request.gameId, true);
      } else {
        this.gameService.findAll().subscribe({
          // ONLINE games have no runs to start: they are tracked through online playtime.
          next: (games) =>
            this.games.set([...games].filter(canStartRun).sort((a, b) => a.name.localeCompare(b.name))),
          error: () => this.games.set([]),
        });
      }
    }
  }

  private initEdit(experience: Experience): void {
    this.original = experience;
    this.form.setValue({
      gameId: experience.gameId,
      runLabel: experience.runLabel,
      status: experience.status,
      platformId: experience.platformId,
      startDate: experience.startDate ?? '',
      endDate: experience.endDate ?? '',
      hours: formatDecimalInput(experience.hours, this.lang()),
      rating: formatDecimalInput(experience.rating, this.lang()),
      summary: experience.summary ?? '',
      platinum: experience.platinum,
      replay: experience.replay,
      pros: experience.pros ?? '',
      cons: experience.cons ?? '',
      notes: experience.notes ?? '',
    });
    this.showMore.set(!!(experience.pros || experience.cons || experience.notes));
    this.lockToGame(experience.gameId, false);
  }

  private lockToGame(gameId: number, suggestLabel: boolean): void {
    this.locked.set(true);
    this.form.controls.gameId.setValue(gameId);
    const creating = suggestLabel;
    this.gameService.findById(gameId).subscribe({
      next: (game) => {
        if (creating && !canStartRun(game)) {
          // A new run for an ONLINE game (e.g. from a Steam import): show the game page instead.
          this.close();
          void this.router.navigate(['/games', game.id]);
          return;
        }
        this.lockedGame.set(game);
      },
      error: () => {},
    });
    if (suggestLabel) {
      this.suggestRunLabel(gameId);
    }
  }

  /** "Run N+1" for a game with N runs, unless the user already typed a label. */
  private suggestRunLabel(gameId: number): void {
    const label = this.form.controls.runLabel;
    this.experienceService.findAllByGame(gameId).subscribe({
      next: (runs) => {
        if (!label.dirty && this.form.controls.gameId.value === gameId) {
          label.setValue(nextRunLabel(runs.length));
        }
      },
      error: () => {
        if (!label.dirty && !label.value) {
          label.setValue(nextRunLabel(0));
        }
      },
    });
  }

  // --- Game autocomplete -------------------------------------------------------------------

  protected onQuery(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
    this.listOpen.set(true);
    const selected = this.selectedGame();
    if (selected && selected.name !== value) {
      this.selectedGame.set(null);
      this.form.controls.gameId.setValue(null);
    }
  }

  protected onGameKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.listOpen.set(true);
      if (count > 0) {
        this.activeIndex.update((i) => (i + 1) % count);
      }
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      this.activeIndex.update((i) => (i - 1 + count) % count);
    } else if (event.key === 'Enter' && this.listOpen()) {
      event.preventDefault();
      const game = this.results()[this.activeIndex()];
      if (game) {
        this.selectGame(game);
      }
    } else if (event.key === 'Escape' && this.listOpen()) {
      // Close the list only; the dialog ignores an Escape that was already handled.
      event.preventDefault();
      this.listOpen.set(false);
    }
  }

  protected selectGame(game: Game): void {
    this.selectedGame.set(game);
    this.query.set(game.name);
    this.listOpen.set(false);
    this.form.controls.gameId.setValue(game.id);
    this.suggestRunLabel(game.id);
  }

  // --- Field helpers -------------------------------------------------------------------------

  protected setStatus(status: ExperienceStatus): void {
    this.form.controls.status.setValue(status);
    const { endDate, startDate } = this.form.controls;
    const today = todayIso();
    if (status === 'COMPLETADO' && !endDate.value && (!startDate.value || startDate.value <= today)) {
      endDate.setValue(today);
      this.endSuggested.set(true);
    }
  }

  /**
   * The user picked or cleared the end date: keep the status consistent with it (see statusForEndDate).
   * An empty value with `badInput` is a date being typed segment by segment, not a cleared one.
   */
  protected onEndDateChange(input: Pick<HTMLInputElement, 'value' | 'validity'>): void {
    if (!input.value && input.validity?.badInput) {
      return;
    }
    const status = this.form.controls.status;
    const next = statusForEndDate(status.value, input.value, todayIso());
    if (next !== status.value) {
      status.setValue(next);
    }
  }

  protected startAddPlatform(): void {
    this.addingPlatform.set(true);
    this.newPlatformName.set('');
    this.newPlatformTouched.set(false);
    queueMicrotask(() => document.getElementById('run-form-new-platform')?.focus());
  }

  protected cancelAddPlatform(): void {
    this.addingPlatform.set(false);
    this.newPlatformName.set('');
    this.newPlatformTouched.set(false);
  }

  /** Creates (or finds, case-insensitively) the typed platform and selects it. */
  protected createPlatform(): void {
    this.newPlatformTouched.set(true);
    const name = normalizePlatformName(this.newPlatformName());
    if (this.creatingPlatform() || !isValidPlatformName(name)) {
      return;
    }
    this.creatingPlatform.set(true);
    this.platformService.create({ name }).subscribe({
      next: (platform: Platform) => {
        this.creatingPlatform.set(false);
        this.form.controls.platformId.setValue(platform.id);
        this.cancelAddPlatform();
        queueMicrotask(() => document.getElementById('run-form-platform')?.focus());
      },
      error: (err: unknown) => {
        this.creatingPlatform.set(false);
        toastApiError(this.toast, this.translate, err, 'runForm.platformCreateError');
      },
    });
  }

  protected toggle(control: 'platinum' | 'replay'): void {
    const c = this.form.controls[control];
    c.setValue(!c.value);
  }

  protected showError(name: 'gameId' | 'runLabel' | 'platformId' | 'hours' | 'rating'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  protected dateRangeError(): boolean {
    return this.form.hasError('dateRange');
  }

  // --- Save / close --------------------------------------------------------------------------

  close(): void {
    this.launcher.close();
  }

  submit(): void {
    if (this.saving()) {
      return;
    }
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const gameId = this.form.controls.gameId.value;
    if (this.form.invalid || gameId === null) {
      queueMicrotask(() => document.querySelector<HTMLElement>('app-run-form [aria-invalid="true"]')?.focus());
      return;
    }

    const request = this.request();
    const body = buildExperienceRequest(this.form.getRawValue() as RunFormValue, this.original);
    const call$ = this.original
      ? this.experienceService.update(this.original.id, body)
      : this.experienceService.create(gameId, body);

    this.saving.set(true);
    call$.subscribe({
      next: (experience) => {
        const created = this.original === null;
        this.toast.success(this.translate.instant(created ? 'runForm.created' : 'runForm.updated'));
        this.launcher.notifySaved({ experience, created });
        if (created && request.mode === 'create' && request.navigateOnCreate) {
          this.router.navigate(['/games', experience.gameId, 'experiences', experience.id]);
        }
      },
      error: (err: unknown) => {
        this.saving.set(false);
        toastApiError(this.toast, this.translate, err, 'runForm.saveError');
      },
    });
  }
}
