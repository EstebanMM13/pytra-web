import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Game } from '../../../core/models/game.model';
import { Saga } from '../../../core/models/saga.model';
import { GameService } from '../../../core/services/game.service';
import { SagaService } from '../../../core/services/saga.service';
import { Navbar } from '../../../shared/navbar/navbar';

@Component({
  selector: 'app-saga-detail',
  imports: [RouterLink, Navbar],
  templateUrl: './saga-detail.html',
})
export class SagaDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly sagaService = inject(SagaService);
  private readonly gameService = inject(GameService);

  private readonly sagaId = Number(this.route.snapshot.paramMap.get('id'));

  readonly saga = signal<Saga | null>(null);
  readonly games = signal<Game[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.sagaService.findById(this.sagaId).subscribe({
      next: (saga) => this.saga.set(saga),
      error: () => this.error.set('No se pudo cargar la saga.'),
    });

    this.gameService.findAll().subscribe({
      next: (games) => {
        this.games.set(games.filter((g) => g.sagaId === this.sagaId));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  gameGenreNames(game: Game): string {
    return game.genres.map((g) => g.name).join(', ');
  }
}
