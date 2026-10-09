import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationStart, Router } from '@angular/router';
import { LucideSearch } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, filter, map, startWith } from 'rxjs';
import { Experience, ExperienceStatus, Platform } from '../../../core/models/experience.model';
import { Game } from '../../../core/models/game.model';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import { RunFormLauncher, RunFormRequest } from '../../../core/services/run-form-launcher.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { ModalSheet } from '../../../shared/ui/modal-sheet';
import { Segmented, SegmentedOption } from '../../../shared/ui/segmented';
import { todayIso } from '../../../shared/utils/run-dates';
import {
  RUN_PLATFORMS,
  RUN_STATUSES,
  RunFormValue,
  buildExperienceRequest,
  dateRangeValidator,
  hoursValidator,
  nextRunLabel,
  ratingValidator,
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
  imports: [ReactiveFormsModule, TranslatePipe, ModalSheet, Segmented, LucideSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './run-form.html',
  styleUrl: './run-form.css',
})
export class RunForm implements OnInit {
  readonly request = input.required<RunFormRequest>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly gameService = inject(GameService);
  private readonly experienceService = inject(ExperienceService);
  private readonly launcher = inject(RunFormLauncher);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly platforms = RUN_PLATFORMS;
  protected readonly statusOptions: SegmentedOption<ExperienceStatus>[] = RUN_STATUSES.map((s) => ({
    value: s,
    label: `status.${s}`,
  }));

  readonly form = this.fb.group(
    {
      gameId: this.fb.control<number | null>(null, Validators.required),
      runLabel: this.fb.control('', [Validators.required, Validators.pattern(/\S/)]),
      status: this.fb.control<ExperienceStatus>('EN_CURSO'),
      platform: this.fb.control<Platform>('PC'),
      startDate: this.fb.control(''),
      endDate: this.fb.control(''),
      hours: this.fb.control<number | null>(null, hoursValidator),
      rating: this.fb.control<number | null>(null, ratingValidator),
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
  protected readonly platform = this.controlSignal(this.form.controls.platform.valueChanges, () => this.form.controls.platform.value);
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
    if (request.mode === 'edit') {
      this.initEdit(request.experience);
    } else {
      this.form.patchValue({
        platform: request.prefill?.platform ?? 'PC',
        hours: request.prefill?.hours ?? null,
      });
      if (request.gameId !== undefined) {
        this.lockToGame(request.gameId, true);
      } else {
        this.gameService.findAll().subscribe({
          next: (games) => this.games.set([...games].sort((a, b) => a.name.localeCompare(b.name))),
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
      platform: experience.platform,
      startDate: experience.startDate ?? '',
      endDate: experience.endDate ?? '',
      hours: experience.hours,
      rating: experience.rating,
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
    this.gameService.findById(gameId).subscribe({ next: (game) => this.lockedGame.set(game), error: () => {} });
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

  protected setPlatform(platform: Platform): void {
    this.form.controls.platform.setValue(platform);
  }

  protected toggle(control: 'platinum' | 'replay'): void {
    const c = this.form.controls[control];
    c.setValue(!c.value);
  }

  protected showError(name: 'gameId' | 'runLabel' | 'hours' | 'rating'): boolean {
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
      error: () => {
        this.saving.set(false);
        this.toast.error(this.translate.instant('runForm.saveError'));
      },
    });
  }
}
