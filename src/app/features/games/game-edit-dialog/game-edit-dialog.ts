import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  linkedSignal,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS } from '../../../shared/ui/icons';
import { map, startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { formatGenreName } from '../../../shared/pipes/genre-name.pipe';
import { Combobox, ComboboxOption } from '../../../shared/ui/combobox';
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
import { IgdbMetadataService } from '../../../core/services/igdb-metadata.service';
import { MetadataAutofill } from './metadata-autofill';
import { AUTOFILL_SOURCE_LABELS, AutofillPick, matchGenres } from './metadata-autofill.logic';
import { toastApiError } from '../../../shared/utils/api-error';

/** Warn about a cover only once its preview loaded and turned out not to be portrait art. */
export function coverNeedsWarning(previewUrl: string | null, portrait: boolean): boolean {
  return !!previewUrl && !portrait;
}

function sortByName(sagas: readonly Saga[]): Saga[] {
  return [...sagas].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

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
    Combobox,
    ModalSheet,
    Segmented,
    GameCover,
    MetadataAutofill,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-edit-dialog.html',
  styleUrl: './game-edit-dialog.css',
})
export class GameEditDialog implements OnInit {
  protected readonly icons = ICONS;

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
  private readonly igdbService = inject(IgdbMetadataService);
  private readonly autofillButton = viewChild<ElementRef<HTMLButtonElement>>('autofillButton');

  protected readonly categoryOptions: SegmentedOption<GameCategory>[] = (
    ['SINGLEPLAYER', 'ONLINE', 'HYBRID'] as const
  ).map((c) => ({ value: c, label: `category.${c}` }));

  protected readonly sagas = signal<Saga[]>([]);
  protected readonly genres = signal<Genre[]>([]);
  protected readonly selectedGenreIds = signal<Set<number>>(new Set());
  protected readonly category = signal<GameCategory>('SINGLEPLAYER');
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly autofillOpen = signal(false);
  /** Whether the API offers IGDB as an autofill source (asked once, on open). */
  protected readonly igdbEnabled = signal(false);
  /** Game and source the form was last filled from (shown as a "review before saving" note). */
  protected readonly filledFrom = signal<{ name: string; source: string } | null>(null);
  /** Source genres the user has no genre for yet; one click creates and selects them. */
  protected readonly suggestedGenres = signal<string[]>([]);
  /** A genre / saga create request is in flight (one at a time, so a retry cannot double-post). */
  protected readonly creatingGenre = signal(false);
  protected readonly creatingSaga = signal(false);

  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.pattern(/\S/)]),
    developer: this.fb.control(''),
    publisher: this.fb.control(''),
    releaseDate: this.fb.control(''),
    sagaId: this.fb.control<number | null>(null),
    coverImageUrl: this.fb.control('', [httpsUrlValidator]),
  });

  /** Genre combobox rows: display names, alphabetical. */
  protected readonly genreOptions = computed<ComboboxOption[]>(() =>
    this.genres()
      .map((g) => ({ id: g.id, label: formatGenreName(g.name) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es')),
  );
  protected readonly genreSelection = computed(() => [...this.selectedGenreIds()]);

  protected readonly sagaOptions = computed<ComboboxOption[]>(() =>
    this.sagas().map((s) => ({ id: s.id, label: s.name })),
  );
  protected readonly sagaSelection = toSignal(
    this.form.controls.sagaId.valueChanges.pipe(map((id) => (id === null ? [] : [id]))),
    { initialValue: [] as number[] },
  );

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

  /** Whether the previewed cover loaded as portrait art; resets (to true) whenever the url changes. */
  protected readonly coverPortrait = linkedSignal({ source: this.coverPreview, computation: () => true });
  protected readonly showCoverWarning = computed(() => coverNeedsWarning(this.coverPreview(), this.coverPortrait()));

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
      next: (sagas) => this.sagas.set(sortByName(sagas)),
      error: () => {},
    });
    this.genreService.findAll().subscribe({ next: (genres) => this.genres.set(genres), error: () => {} });
    this.igdbService.providers().subscribe((providers) => this.igdbEnabled.set(providers.igdb));
  }

  /** Picks from the genre combobox (chips keep their pick order). */
  protected toSet(ids: readonly number[]): Set<number> {
    return new Set(ids);
  }

  protected selectSaga(ids: readonly number[]): void {
    this.form.controls.sagaId.setValue(ids[0] ?? null);
    this.form.controls.sagaId.markAsDirty();
  }

  /** Creates a saga from the combobox search and selects it. */
  protected createSaga(name: string): void {
    if (this.creatingSaga()) return;
    this.creatingSaga.set(true);
    this.sagaService.create({ name }).subscribe({
      next: (saga) => {
        this.creatingSaga.set(false);
        this.sagas.update((list) => sortByName([...list.filter((s) => s.id !== saga.id), saga]));
        this.selectSaga([saga.id]);
      },
      error: (err: unknown) => {
        this.creatingSaga.set(false);
        toastApiError(this.toast, this.translate, err, 'sagas.saveError');
      },
    });
  }

  protected addSuggestedGenre(name: string): void {
    this.createAndSelectGenre(name, () => this.suggestedGenres.update((list) => list.filter((n) => n !== name)));
  }

  protected createAndSelectGenre(name: string, onCreated: () => void = () => {}): void {
    if (this.creatingGenre()) return;
    this.creatingGenre.set(true);
    this.genreService.createIfMissing({ name }).subscribe({
      next: (genre) => {
        this.creatingGenre.set(false);
        if (!this.genres().some((g) => g.id === genre.id)) {
          this.genres.update((list) => [...list, genre]);
        }
        this.selectedGenreIds.update((s) => new Set(s).add(genre.id));
        onCreated();
      },
      error: (err: unknown) => {
        this.creatingGenre.set(false);
        toastApiError(this.toast, this.translate, err, 'game.genreError');
      },
    });
  }

  /**
   * Prefills the form from IGDB or Steam. Source values overwrite the fields they have (missing ones
   * keep what the user typed); matching genres are added to the selection. Nothing is saved until "Save".
   */
  protected applyAutofill({ source, metadata }: AutofillPick): void {
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
    this.filledFrom.set({ name: metadata.name, source: AUTOFILL_SOURCE_LABELS[source] });
    this.closeAutofill();
  }

  /** Opens the IGDB / Steam search (it focuses its own input) to pick an official portrait cover. */
  protected openAutofill(): void {
    this.autofillOpen.set(true);
  }

  /** Hides the autofill search and gives focus back to the button that opened it. */
  protected closeAutofill(): void {
    this.autofillOpen.set(false);
    afterNextRender(() => this.autofillButton()?.nativeElement.focus(), { injector: this.injector });
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
      error: (err: unknown) => {
        this.saving.set(false);
        toastApiError(this.toast, this.translate, err, 'game.saveError');
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
      error: (err: unknown) => {
        this.deleting.set(false);
        toastApiError(this.toast, this.translate, err, 'game.deleteError');
      },
    });
  }
}
