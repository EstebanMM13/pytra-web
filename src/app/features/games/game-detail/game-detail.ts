import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Experience, ExperienceRequest } from '../../../core/models/experience.model';
import { Game } from '../../../core/models/game.model';
import { OnlinePlaytime } from '../../../core/models/online-playtime.model';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import { OnlinePlaytimeService } from '../../../core/services/online-playtime.service';
import { Navbar } from '../../../shared/navbar/navbar';
import { ExperienceForm } from '../experience-form/experience-form';
import { HoursPipe } from '../../../shared/pipes/hours.pipe';

@Component({
  selector: 'app-game-detail',
  imports: [ReactiveFormsModule, RouterLink, Navbar, ExperienceForm, HoursPipe],
  templateUrl: './game-detail.html',
})
export class GameDetail {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly gameService = inject(GameService);
  private readonly experienceService = inject(ExperienceService);
  private readonly onlinePlaytimeService = inject(OnlinePlaytimeService);

  readonly gameId = Number(this.route.snapshot.paramMap.get('id'));

  readonly game = signal<Game | null>(null);
  readonly experiences = signal<Experience[]>([]);
  readonly onlinePlaytime = signal<OnlinePlaytime | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly showExperienceForm = signal(false);
  readonly editingExperience = signal<Experience | null>(null);

  readonly onlinePlaytimeForm = this.fb.group({
    totalHours: this.fb.control(0, [Validators.required, Validators.min(0)]),
    generalRating: this.fb.control<number | null>(null),
    notes: this.fb.control(''),
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.gameService.findById(this.gameId).subscribe({
      next: (game) => {
        this.game.set(game);
        this.loading.set(false);

        // Las horas online solo tienen sentido para juegos ONLINE/HYBRID —
        // un SINGLEPLAYER nunca llega a tener OnlinePlaytime en el backend.
        if (game.category !== 'SINGLEPLAYER') {
          this.onlinePlaytimeService.findByGame(this.gameId).subscribe({
            next: (playtime) => {
              this.onlinePlaytime.set(playtime);
              this.onlinePlaytimeForm.setValue({
                totalHours: playtime.totalHours,
                generalRating: playtime.generalRating,
                notes: playtime.notes ?? '',
              });
            },
            error: () => {
              // 404: todavía no hay horas online registradas para este juego.
            },
          });
        }
      },
      error: () => {
        this.error.set('No se pudo cargar el juego.');
        this.loading.set(false);
      },
    });

    this.experienceService.findAllByGame(this.gameId).subscribe((experiences) =>
      this.experiences.set(experiences)
    );
  }

  openCreateExperienceForm(): void {
    this.editingExperience.set(null);
    this.showExperienceForm.set(true);
  }

  openEditExperienceForm(experience: Experience): void {
    this.editingExperience.set(experience);
    this.showExperienceForm.set(true);
  }

  cancelExperienceForm(): void {
    this.showExperienceForm.set(false);
  }

  submitExperience(request: ExperienceRequest): void {
    const editing = this.editingExperience();
    const request$ = editing
      ? this.experienceService.update(editing.id, request)
      : this.experienceService.create(this.gameId, request);

    request$.subscribe({
      next: (experience) => {
        this.experiences.update((list) =>
          editing ? list.map((e) => (e.id === editing.id ? experience : e)) : [...list, experience]
        );
        this.showExperienceForm.set(false);
      },
      error: () => this.error.set('No se pudo guardar la partida.'),
    });
  }

  removeExperience(experience: Experience): void {
    if (!confirm('¿Borrar esta partida?')) return;

    this.experienceService.delete(experience.id).subscribe({
      next: () => this.experiences.update((list) => list.filter((e) => e.id !== experience.id)),
      error: () => this.error.set('No se pudo borrar la partida.'),
    });
  }

  submitOnlinePlaytime(): void {
    if (this.onlinePlaytimeForm.invalid) {
      this.onlinePlaytimeForm.markAllAsTouched();
      return;
    }

    this.onlinePlaytimeService.upsert(this.gameId, this.onlinePlaytimeForm.getRawValue()).subscribe({
      next: (playtime) => this.onlinePlaytime.set(playtime),
      error: () => this.error.set('No se pudieron guardar las horas online.'),
    });
  }
}
