import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideTrash2 } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Saga } from '../../core/models/saga.model';
import { SagaService } from '../../core/services/saga.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ModalSheet } from '../../shared/ui/modal-sheet';

/** Create (no `saga`) or rename/delete a saga in a modal / mobile sheet. */
@Component({
  selector: 'app-saga-dialog',
  imports: [ReactiveFormsModule, TranslatePipe, ModalSheet, LucideTrash2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-sheet
      [title]="(saga() ? 'sagas.editTitle' : 'sagas.createTitle') | translate"
      [saveLabel]="(saga() ? 'sagas.saveEdit' : 'sagas.saveCreate') | translate"
      [saving]="saving()"
      (save)="submit()"
      (closed)="closed.emit()"
    >
      <form (ngSubmit)="submit()" novalidate class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label for="saga-name" class="text-[13px] text-text-3">{{ 'sagas.form.name' | translate }}</label>
          <input
            id="saga-name"
            data-autofocus
            type="text"
            [formControl]="name"
            class="h-[50px] w-full rounded-xl border border-border bg-surface px-3.5 text-[16px] text-text md:h-[46px] md:rounded-[10px] md:bg-bg md:text-[15px]"
            [class.border-danger]="name.invalid && name.touched"
            [attr.aria-invalid]="name.invalid && name.touched"
          />
          @if (name.invalid && name.touched) {
            <p class="text-xs text-danger">{{ 'sagas.form.nameRequired' | translate }}</p>
          }
        </div>

        @if (saga()) {
          <div class="border-t border-divider pt-4">
            <p class="mb-2 text-xs text-muted">{{ 'sagas.deleteHint' | translate }}</p>
            <button
              type="button"
              (click)="remove()"
              [disabled]="deleting()"
              class="flex items-center gap-2 rounded-md text-[13px] font-medium text-danger hover:underline disabled:opacity-50"
            >
              <svg lucideTrash2 [size]="15"></svg>
              {{ 'sagas.delete' | translate }}
            </button>
          </div>
        }
      </form>
    </app-modal-sheet>
  `,
})
export class SagaDialog implements OnInit {
  readonly saga = input<Saga | null>(null);
  readonly saved = output<Saga>();
  readonly deleted = output<number>();
  readonly closed = output<void>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly sagaService = inject(SagaService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly name = this.fb.control('', [Validators.required, Validators.pattern(/\S/)]);

  ngOnInit(): void {
    this.name.setValue(this.saga()?.name ?? '');
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    if (this.name.invalid) {
      this.name.markAsTouched();
      return;
    }
    const saga = this.saga();
    const request = { name: this.name.value.trim() };
    this.saving.set(true);
    (saga ? this.sagaService.update(saga.id, request) : this.sagaService.create(request)).subscribe({
      next: (result) => {
        this.toast.success(this.translate.instant(saga ? 'sagas.saved' : 'sagas.created'));
        this.saved.emit(result);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error(this.translate.instant('sagas.saveError'));
      },
    });
  }

  protected remove(): void {
    const saga = this.saga();
    if (!saga || this.deleting() || !confirm(this.translate.instant('sagas.deleteConfirm'))) {
      return;
    }
    this.deleting.set(true);
    this.sagaService.delete(saga.id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('sagas.deleted'));
        this.deleted.emit(saga.id);
      },
      error: () => {
        this.deleting.set(false);
        this.toast.error(this.translate.instant('sagas.deleteError'));
      },
    });
  }
}
