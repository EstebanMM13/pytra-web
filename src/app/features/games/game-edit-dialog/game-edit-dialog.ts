import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideTrash2 } from '@lucide/angular';
import { map, startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Game, GameCategory, GameRequest } from '../../../core/models/game.model';
import { Genre } from '../../../core/models/genre.model';
import { Saga } from '../../../core/models/saga.model';
import { GameService } from '../../../core/services/game.service';
import { GenreService } from '../../../core/services/genre.service';
import { SagaService } from '../../../core/services/saga.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { ModalSheet } from '../../../shared/ui/modal-sheet';
import { GameCover } from '../../../shared/ui/game-cover';
import { Segmented, SegmentedOption } from '../../../shared/ui/segmented';

/** Empty, or an absolute https URL with a host. */
function httpsUrlValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname ? null : { httpsUrl: true };
  } catch {
    return { httpsUrl: true };
  }
}

/**
 * Create or edit a game's sheet (name, studio, release, category, saga, genres) in a modal / mobile sheet.
 * Without `game` it creates a new one; in edit mode it also offers deleting the game.
 */
@Component({
  selector: 'app-game-edit-dialog',
  imports: [ReactiveFormsModule, TranslatePipe, ModalSheet, Segmented, GameCover, LucideTrash2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-edit-dialog.html',
  styleUrl: './game-edit-dialog.css',
})
export class GameEditDialog implements OnInit {
  /** Game to edit; `null` opens the dialog in create mode. */
  readonly game = input<Game | null>(null);
  readonly saved = output<Game>();
  /** Emits the id of the deleted game (edit mode only). */
  readonly deleted = output<number>();
  readonly closed = output<void>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly gameService = inject(GameService);
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
  protected readonly deleting = signal(false);

  protected readonly newGenreName = this.fb.control('');
  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.pattern(/\S/)]),
    developer: this.fb.control(''),
    publisher: this.fb.control(''),
    releaseDate: this.fb.control(''),
    sagaId: this.fb.control<number | null>(null),
    coverImageUrl: this.fb.control('', [httpsUrlValidator]),
  });

  /** Valid cover url for the live preview, or null. */
  protected readonly coverPreview = toSignal(
    this.form.controls.coverImageUrl.valueChanges.pipe(
      startWith(''),
      map(() => {
        const control = this.form.controls.coverImageUrl;
        return control.valid ? control.value.trim() || null : null;
      }),
    ),
    { initialValue: null },
  );

  ngOnInit(): void {
    const game = this.game();
    if (game) {
      this.form.setValue({
        name: game.name,
        developer: game.developer ?? '',
        publisher: game.publisher ?? '',
        releaseDate: game.releaseDate ?? '',
        sagaId: game.sagaId,
        coverImageUrl: game.coverImageUrl ?? '',
      });
      this.category.set(game.category ?? 'SINGLEPLAYER');
      this.selectedGenreIds.set(new Set(game.genres.map((g) => g.id)));
    }
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

  protected addGenre(): void {
    const name = this.newGenreName.value.trim();
    if (!name) {
      return;
    }
    this.genreService.createIfMissing({ name }).subscribe({
      next: (genre) => {
        if (!this.genres().some((g) => g.id === genre.id)) {
          this.genres.update((list) => [...list, genre]);
        }
        this.selectedGenreIds.update((s) => new Set(s).add(genre.id));
        this.newGenreName.setValue('');
      },
      error: () => this.toast.error(this.translate.instant('game.genreError')),
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
    const raw = this.form.getRawValue();
    const game = this.game();
    const request: GameRequest = {
      name: raw.name.trim(),
      developer: raw.developer.trim() || null,
      publisher: raw.publisher.trim() || null,
      releaseDate: raw.releaseDate || null,
      category: this.category(),
      sagaId: raw.sagaId,
      coverImageUrl: raw.coverImageUrl.trim() || null,
      genreIds: [...this.selectedGenreIds()],
    };
    this.saving.set(true);
    const request$ = game ? this.gameService.update(game.id, request) : this.gameService.create(request);
    request$.subscribe({
      next: (updated) => {
        this.toast.success(this.translate.instant(game ? 'game.saved' : 'game.created'));
        this.saved.emit(updated);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error(this.translate.instant('game.saveError'));
      },
    });
  }

  protected remove(): void {
    const game = this.game();
    if (!game || this.deleting() || !confirm(this.translate.instant('game.deleteConfirm'))) {
      return;
    }
    this.deleting.set(true);
    this.gameService.delete(game.id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('game.deleted'));
        this.deleted.emit(game.id);
      },
      error: () => {
        this.deleting.set(false);
        this.toast.error(this.translate.instant('game.deleteError'));
      },
    });
  }
}
