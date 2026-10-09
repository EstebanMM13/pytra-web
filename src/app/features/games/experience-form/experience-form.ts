import { Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExperienceFormData, ExperienceRequest, ExperienceStatus, Platform } from '../../../core/models/experience.model';

@Component({
  selector: 'app-experience-form',
  imports: [ReactiveFormsModule],
  templateUrl: './experience-form.html',
})
export class ExperienceForm {
  readonly initial = input<ExperienceFormData | null>(null);
  readonly save = output<ExperienceRequest>();
  readonly cancel = output<void>();

  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses: ExperienceStatus[] = ['EN_CURSO', 'COMPLETADO', 'ABANDONADO', 'PENDIENTE'];
  readonly platforms: Platform[] = ['PC', 'PS5', 'PS4', 'XBOX', 'SWITCH', 'MOBILE'];

  readonly form = this.fb.group({
    runLabel: this.fb.control('', Validators.required),
    year: this.fb.control<number | null>(null),
    status: this.fb.control<ExperienceStatus>('EN_CURSO', Validators.required),
    rating: this.fb.control<number | null>(null),
    hours: this.fb.control<number | null>(null),
    startDate: this.fb.control(''),
    endDate: this.fb.control(''),
    platform: this.fb.control<Platform>('PC', Validators.required),
    platinum: this.fb.control(false),
    replay: this.fb.control(false),
    summary: this.fb.control(''),
    pros: this.fb.control(''),
    cons: this.fb.control(''),
    notes: this.fb.control(''),
  });

  constructor() {
    effect(() => {
      const experience = this.initial();
      if (experience) {
        this.form.setValue({
          runLabel: experience.runLabel,
          year: experience.year,
          status: experience.status,
          rating: experience.rating,
          hours: experience.hours,
          startDate: experience.startDate ?? '',
          endDate: experience.endDate ?? '',
          platform: experience.platform,
          platinum: experience.platinum,
          replay: experience.replay,
          summary: experience.summary ?? '',
          pros: experience.pros ?? '',
          cons: experience.cons ?? '',
          notes: experience.notes ?? '',
        });
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.save.emit(this.form.getRawValue());
  }
}
