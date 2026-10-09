import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Experience, ExperienceRequest } from '../../../core/models/experience.model';
import { Game } from '../../../core/models/game.model';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import { Navbar } from '../../../shared/navbar/navbar';
import { ExperienceForm } from '../experience-form/experience-form';
import { HoursPipe } from '../../../shared/pipes/hours.pipe';

@Component({
  selector: 'app-experience-detail',
  imports: [RouterLink, Navbar, ExperienceForm, HoursPipe],
  templateUrl: './experience-detail.html',
})
export class ExperienceDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly experienceService = inject(ExperienceService);
  private readonly gameService = inject(GameService);

  readonly gameId = Number(this.route.snapshot.paramMap.get('gameId'));
  private readonly experienceId = Number(this.route.snapshot.paramMap.get('id'));

  readonly experience = signal<Experience | null>(null);
  readonly game = signal<Game | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly editing = signal(false);

  constructor() {
    this.experienceService.findById(this.experienceId).subscribe({
      next: (experience) => {
        this.experience.set(experience);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la partida.');
        this.loading.set(false);
      },
    });

    this.gameService.findById(this.gameId).subscribe((game) => this.game.set(game));
  }

  startEdit(): void {
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  save(request: ExperienceRequest): void {
    this.experienceService.update(this.experienceId, request).subscribe({
      next: (experience) => {
        this.experience.set(experience);
        this.editing.set(false);
      },
      error: () => this.error.set('No se pudo guardar la partida.'),
    });
  }
}
