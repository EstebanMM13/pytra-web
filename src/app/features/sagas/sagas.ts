import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Saga } from '../../core/models/saga.model';
import { SagaService } from '../../core/services/saga.service';
import { Navbar } from '../../shared/navbar/navbar';

@Component({
  selector: 'app-sagas',
  imports: [ReactiveFormsModule, RouterLink, Navbar],
  templateUrl: './sagas.html',
})
export class Sagas {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly sagaService = inject(SagaService);

  readonly sagas = signal<Saga[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly editingId = signal<number | null>(null);

  readonly createForm = this.fb.group({
    name: this.fb.control('', Validators.required),
  });

  readonly editForm = this.fb.group({
    name: this.fb.control('', Validators.required),
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.sagaService.findAll().subscribe({
      next: (sagas) => {
        this.sagas.set(sagas);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las sagas.');
        this.loading.set(false);
      },
    });
  }

  create(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const name = this.createForm.getRawValue().name;

    this.sagaService.create({ name }).subscribe({
      next: (saga) => {
        this.sagas.update((list) => [...list, saga]);
        this.createForm.reset({ name: '' });
      },
      error: () => this.error.set('No se pudo crear la saga (¿nombre repetido?).'),
    });
  }

  startEdit(saga: Saga): void {
    this.editingId.set(saga.id);
    this.editForm.setValue({ name: saga.name });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(saga: Saga): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const name = this.editForm.getRawValue().name;

    this.sagaService.update(saga.id, { name }).subscribe({
      next: (updated) => {
        this.sagas.update((list) => list.map((s) => (s.id === saga.id ? updated : s)));
        this.editingId.set(null);
      },
      error: () => this.error.set('No se pudo renombrar la saga (¿nombre repetido?).'),
    });
  }

  remove(saga: Saga): void {
    if (!confirm('¿Borrar esta saga? Los juegos asociados no se borran, se quedan sin saga.')) {
      return;
    }

    this.sagaService.delete(saga.id).subscribe({
      next: () => this.sagas.update((list) => list.filter((s) => s.id !== saga.id)),
      error: () => this.error.set('No se pudo borrar la saga.'),
    });
  }
}
