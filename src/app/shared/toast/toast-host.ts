import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideCheck, LucideCircleAlert, LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { ToastService } from './toast.service';

/** Renders the toast stack: bottom-centre above the mobile tab bar, bottom-right on web. */
@Component({
  selector: 'app-toast-host',
  imports: [TranslatePipe, LucideCheck, LucideCircleAlert, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'pointer-events-none fixed inset-x-0 bottom-[calc(104px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-5 md:inset-x-auto md:right-6 md:bottom-6 md:items-end md:px-0',
    role: 'status',
    'aria-live': 'polite',
  },
  template: `
    @for (toast of toasts(); track toast.id) {
      <div
        class="pointer-events-auto flex max-w-sm animate-modal-in items-center gap-2.5 rounded-xl border border-border bg-surface py-2.5 pr-2 pl-3.5 text-sm text-text-2 shadow-[0_12px_32px_#0006]"
      >
        @if (toast.tone === 'success') {
          <svg lucideCheck [size]="16" class="shrink-0 text-success"></svg>
        } @else {
          <svg lucideCircleAlert [size]="16" class="shrink-0 text-danger"></svg>
        }
        <span class="min-w-0 flex-1">{{ toast.message }}</span>
        <button
          type="button"
          (click)="dismiss(toast.id)"
          class="rounded-md p-1 text-muted hover:text-text"
          [attr.aria-label]="'toast.close' | translate"
        >
          <svg lucideX [size]="14"></svg>
        </button>
      </div>
    }
  `,
})
export class ToastHost {
  private readonly toastService = inject(ToastService);
  protected readonly toasts = this.toastService.toasts;

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
