import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Game, GameCategory } from '../../core/models/game.model';
import { Genre } from '../../core/models/genre.model';
import { Saga } from '../../core/models/saga.model';
import { GenreService } from '../../core/services/genre.service';
import { SagaService } from '../../core/services/saga.service';
import { SteamService } from '../../core/services/steam.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ModalSheet } from '../../shared/ui/modal-sheet';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented';
import { confirmErrorKey } from './steam.logic';

/** `confirm`: only add the game to the library. `run`: the caller opens a run right after. */
export type SteamConfirmMode = 'confirm' | 'run';

/**
 * Compact review step for a Steam game pending review: name, category (required) and optional
 * saga/genres, then PUT /pending/{id}/confirm. Emits the confirmed game.
 */
@Component({
  selector: 'app-steam-confirm-dialog',
  imports: [ReactiveFormsModule, TranslatePipe, ModalSheet, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-sheet
      [title]="'steam.confirmDialog.title' | translate"
      [saveLabel]="(mode() === 'run' ? 'steam.confirmDialog.saveAndRun' : 'steam.confirmDialog.save') | translate"
      [saving]="saving()"
      (save)="submit()"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="flex flex-col gap-4 md:gap-[18px]">
        <p class="text-[13px] leading-relaxed text-muted">
          {{ (mode() === 'run' ? 'steam.confirmDialog.introRun' : 'steam.confirmDialog.intro') | translate }}
        </p>

        <div class="flex flex-col gap-2">
          <label for="steam-confirm-name" class="text-[13px] text-text-3">{{ 'steam.form.name' | translate }}</label>
          <input
            id="steam-confirm-name"
            data-autofocus
            type="text"
            formControlName="name"
            class="h-[50px] w-full rounded-xl border border-border bg-surface px-3.5 text-[16px] text-text md:h-[46px] md:rounded-[10px] md:bg-bg md:text-[15px]"
            [attr.aria-invalid]="form.controls.name.invalid && form.controls.name.touched"
          />
          @if (form.controls.name.invalid && form.controls.name.touched) {
            <p class="text-xs text-danger">{{ 'game.form.nameRequired' | translate }}</p>
          }
        </div>

        <div class="flex flex-col gap-2">
          <span id="steam-confirm-category" class="text-[13px] text-text-3">{{ 'steam.form.category' | translate }}</span>
          <app-segmented
            stretch
            aria-labelledby="steam-confirm-category"
            [options]="categoryOptions"
            [value]="category()"
            (valueChange)="category.set($event)"
          />
          <p class="text-xs text-muted">{{ 'steam.confirmDialog.categoryHint' | translate }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <label for="steam-confirm-saga" class="text-[13px] text-text-3">{{ 'steam.form.saga' | translate }}</label>
          <select
            id="steam-confirm-saga"
            formControlName="sagaId"
            class="h-[50px] w-full rounded-xl border border-border bg-surface px-3.5 text-[16px] text-text md:h-[46px] md:rounded-[10px] md:bg-bg md:text-[15px]"
          >
            <option [ngValue]="null">{{ 'steam.form.noSaga' | translate }}</option>
            @for (saga of sagas(); track saga.id) {
              <option [ngValue]="saga.id">{{ saga.name }}</option>
            }
          </select>
        </div>

        @if (genres().length > 0) {
          <div class="flex flex-col gap-2">
            <span id="steam-confirm-genres" class="text-[13px] text-text-3">{{ 'steam.form.genres' | translate }}</span>
            <div class="flex flex-wrap gap-2" role="group" aria-labelledby="steam-confirm-genres">
              @for (genre of genres(); track genre.id) {
                <button
                  type="button"
                  [attr.aria-pressed]="selectedGenreIds().has(genre.id)"
                  (click)="toggleGenre(genre.id)"
                  class="rounded-full border px-3.5 py-[7px] text-[13px]"
                  [class]="
                    selectedGenreIds().has(genre.id)
                      ? 'border-brand bg-brand-tint text-brand-lighter'
                      : 'border-border text-text-2 hover:border-border-strong'
                  "
                >
                  {{ genre.name }}
                </button>
              }
            </div>
          </div>
        }
      </form>
    </app-modal-sheet>
  `,
})
export class SteamConfirmDialog implements OnInit {
  readonly game = input.required<Game>();
  readonly mode = input<SteamConfirmMode>('confirm');
  readonly confirmed = output<Game>();
  readonly closed = output<void>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly steamService = inject(SteamService);
  private readonly sagaService = inject(SagaService);
  private readonly genreService = inject(GenreService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly categoryOptions: SegmentedOption<GameCategory>[] = (
    ['SINGLEPLAYER', 'ONLINE', 'HYBRID'] as const
  ).map((c) => ({ value: c, label: `category.${c}` }));

  protected readonly sagas = signal<Saga[]>([]);
  protected readonly genres = signal<Genre[]>([]);
  protected readonly selectedGenreIds = signal<Set<number>>(new Set());
  protected readonly category = signal<GameCategory>('SINGLEPLAYER');
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.pattern(/\S/)]),
    sagaId: this.fb.control<number | null>(null),
  });

  ngOnInit(): void {
    const game = this.game();
    this.form.setValue({ name: game.name, sagaId: game.sagaId });
    this.category.set(game.category ?? 'SINGLEPLAYER');
    this.selectedGenreIds.set(new Set(game.genres.map((g) => g.id)));
    this.sagaService.findAll().subscribe({
      next: (sagas) => this.sagas.set([...sagas].sort((a, b) => a.name.localeCompare(b.name))),
      error: () => {},
    });
    this.genreService.findAll().subscribe({ next: (genres) => this.genres.set(genres), error: () => {} });
  }

  protected toggleGenre(id: number): void {
    this.selectedGenreIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const game = this.game();
    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.steamService
      .confirmPending(game.id, {
        name: raw.name.trim(),
        // Fields this step does not edit: send what the import already has.
        developer: game.developer,
        publisher: game.publisher,
        releaseDate: game.releaseDate,
        coverImageUrl: game.coverImageUrl,
        category: this.category(),
        sagaId: raw.sagaId,
        genreIds: [...this.selectedGenreIds()],
      })
      .subscribe({
        next: (confirmed) => this.confirmed.emit(confirmed),
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.toast.error(this.translate.instant(confirmErrorKey(err)));
        },
      });
  }
}
