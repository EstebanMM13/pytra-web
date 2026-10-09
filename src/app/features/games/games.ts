import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Game, GameCategory } from '../../core/models/game.model';
import { Genre } from '../../core/models/genre.model';
import { Saga } from '../../core/models/saga.model';
import { GameService } from '../../core/services/game.service';
import { GenreService } from '../../core/services/genre.service';
import { SagaService } from '../../core/services/saga.service';
import { Navbar } from '../../shared/navbar/navbar';

@Component({
  selector: 'app-games',
  imports: [ReactiveFormsModule, RouterLink, Navbar],
  templateUrl: './games.html',
})
export class Games {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly gameService = inject(GameService);
  private readonly sagaService = inject(SagaService);
  private readonly genreService = inject(GenreService);

  readonly categories: GameCategory[] = ['SINGLEPLAYER', 'ONLINE', 'HYBRID'];

  readonly games = signal<Game[]>([]);
  readonly sagas = signal<Saga[]>([]);
  readonly genres = signal<Genre[]>([]);
  readonly selectedGenreIds = signal<Set<number>>(new Set());

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly editingId = signal<number | null>(null);
  readonly showForm = signal(false);

  readonly newGenreName = this.fb.control('');

  readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    developer: this.fb.control(''),
    publisher: this.fb.control(''),
    releaseDate: this.fb.control(''),
    category: this.fb.control<GameCategory>('SINGLEPLAYER', Validators.required),
    sagaId: this.fb.control<number | null>(null),
    coverImageUrl: this.fb.control(''),
  });

  constructor() {
    this.loadGames();
    this.sagaService.findAll().subscribe((sagas) => this.sagas.set(sagas));
    this.genreService.findAll().subscribe((genres) => this.genres.set(genres));
  }

  loadGames(): void {
    this.loading.set(true);
    this.gameService.findAll().subscribe({
      next: (games) => {
        this.games.set(games);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la lista de juegos.');
        this.loading.set(false);
      },
    });
  }

  openCreateForm(): void {
    this.editingId.set(null);
    this.form.reset({ category: 'SINGLEPLAYER', sagaId: null });
    this.selectedGenreIds.set(new Set());
    this.showForm.set(true);
  }

  openEditForm(game: Game): void {
    this.editingId.set(game.id);
    this.selectedGenreIds.set(new Set(game.genres.map((g) => g.id)));

    this.form.setValue({
      name: game.name,
      developer: game.developer ?? '',
      publisher: game.publisher ?? '',
      releaseDate: game.releaseDate ?? '',
      category: (game.category ?? 'SINGLEPLAYER') as GameCategory,
      sagaId: game.sagaId,
      coverImageUrl: game.coverImageUrl ?? '',
    });
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
  }

  toggleGenre(genreId: number): void {
    this.selectedGenreIds.update((current) => {
      const next = new Set(current);
      next.has(genreId) ? next.delete(genreId) : next.add(genreId);
      return next;
    });
  }

  addGenre(): void {
    const name = this.newGenreName.value.trim();
    if (!name) return;

    this.genreService.createIfMissing({ name }).subscribe({
      next: (genre) => {
        if (!this.genres().some((g) => g.id === genre.id)) {
          this.genres.update((list) => [...list, genre]);
        }
        this.toggleGenre(genre.id);
        this.newGenreName.setValue('');
      },
      error: () => this.error.set('No se pudo crear el género.'),
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request = {
      name: raw.name,
      developer: raw.developer || null,
      publisher: raw.publisher || null,
      releaseDate: raw.releaseDate || null,
      category: raw.category,
      sagaId: raw.sagaId,
      coverImageUrl: raw.coverImageUrl || null,
      genreIds: [...this.selectedGenreIds()],
    };

    const id = this.editingId();
    const request$ = id ? this.gameService.update(id, request) : this.gameService.create(request);

    request$.subscribe({
      next: (game) => {
        this.games.update((list) =>
          id ? list.map((g) => (g.id === id ? game : g)) : [...list, game]
        );
        this.showForm.set(false);
      },
      error: () => this.error.set('No se pudo guardar el juego (¿nombre repetido?).'),
    });
  }

  remove(game: Game): void {
    if (!confirm('¿Borrar este juego?')) return;

    this.gameService.delete(game.id).subscribe({
      next: () => this.games.update((list) => list.filter((g) => g.id !== game.id)),
      error: () => this.error.set('No se pudo borrar el juego.'),
    });
  }

  gameGenreNames(game: Game): string {
    return game.genres.map((g) => g.name).join(', ');
  }
}
