import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucidePlus, LucideTrash2, LucideWandSparkles } from '@lucide/angular';
import { map, startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { GenreNamePipe } from '../../../shared/pipes/genre-name.pipe';
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
import { SteamGameMetadata } from '../../../core/models/steam-metadata.model';
import { SteamAutofill } from './steam-autofill';
import { matchGenres } from './steam-autofill.logic';

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
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    GenreNamePipe,
    ModalSheet,
    Segmented,
    GameCover,
    SteamAutofill,
    LucideTrash2,
    LucideWandSparkles,
    LucidePlus,
  ],
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
  private readonly injector = inject(Injector);
  private readonly steamButton = viewChild<ElementRef<HTMLButtonElement>>('steamButton');

  protected readonly categoryOptions: SegmentedOption<GameCategory>[] = (
    ['SINGLEPLAYER', 'ONLINE', 'HYBRID'] as const
  ).map((c) => ({ value: c, label: `category.${c}` }));

  protected readonly sagas = signal<Saga[]>([]);
  protected readonly genres = signal<Genre[]>([]);
  protected readonly selectedGenreIds = signal<Set<number>>(new Set());
  protected readonly category = signal<GameCategory>('SINGLEPLAYER');
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly steamSearchOpen = signal(false);
  /** Name of the Steam game the form was last filled from (shown as a "review before saving" note). */
  protected readonly steamFilledFrom = signal<string | null>(null);
  /** Steam genres the user has no genre for yet; one click creates and selects them. */
  protected readonly suggestedGenres = signal<string[]>([]);

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
    this.createAndSelectGenre(name, () => this.newGenreName.setValue(''));
  }

  protected addSuggestedGenre(name: string): void {
    this.createAndSelectGenre(name, () => this.suggestedGenres.update((list) => list.filter((n) => n !== name)));
  }

  private createAndSelectGenre(name: string, onCreated: () => void): void {
    this.genreService.createIfMissing({ name }).subscribe({
      next: (genre) => {
        if (!this.genres().some((g) => g.id === genre.id)) {
          this.genres.update((list) => [...list, genre]);
        }
        this.selectedGenreIds.update((s) => new Set(s).add(genre.id));
        onCreated();
      },
      error: () => this.toast.error(this.translate.instant('game.genreError')),
    });
  }

  /**
   * Prefills the form from Steam. Steam values overwrite the fields they have (missing ones keep what
   * the user typed); matching genres are added to the selection. Nothing is saved until "Save".
   */
  protected applySteamMetadata(metadata: SteamGameMetadata): void {
    const controls = this.form.controls;
    controls.name.setValue(metadata.name);
    if (metadata.developer) controls.developer.setValue(metadata.developer);
    if (metadata.publisher) controls.publisher.setValue(metadata.publisher);
    if (metadata.releaseDate) controls.releaseDate.setValue(metadata.releaseDate);
    if (metadata.coverImageUrl) controls.coverImageUrl.setValue(metadata.coverImageUrl);
    this.form.markAsDirty();

    const { matched, unmatched } = matchGenres(metadata.genres, this.genres());
    this.selectedGenreIds.update((current) => new Set([...current, ...matched.map((g) => g.id)]));
    this.suggestedGenres.set(unmatched);
    this.steamFilledFrom.set(metadata.name);
    this.closeSteamSearch();
  }

  /** Hides the Steam search and gives focus back to the button that opened it. */
  protected closeSteamSearch(): void {
    this.steamSearchOpen.set(false);
    afterNextRender(() => this.steamButton()?.nativeElement.focus(), { injector: this.injector });
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
