import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog shell. Web (md+): centred modal (max 720px) over the overlay, fade + 8px rise.
 * Mobile: full-screen sheet sliding up, header "Cancelar · title · Guardar".
 * Handles Escape, a Tab focus trap, body scroll lock and focus restore. The body is projected;
 * the save buttons emit `save` (the content owns validation and submission).
 */
@Component({
  selector: 'app-modal-sheet',
  imports: [TranslatePipe, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape($event)' },
  template: `
    <div class="fixed inset-0 z-50 flex md:items-center md:justify-center md:bg-overlay md:p-6">
      <div
        #panel
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        (keydown)="trapFocus($event)"
        class="flex h-full w-full flex-col bg-bg max-md:animate-sheet-in md:h-auto md:max-h-[calc(100dvh-48px)] md:max-w-[720px] md:animate-modal-in md:rounded-2xl md:border md:border-border md:bg-surface md:shadow-[0_40px_100px_#000a]"
      >
        <!-- Mobile header -->
        <header
          class="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 md:hidden"
        >
          <button type="button" (click)="closed.emit()" class="text-[15px] text-text-3">
            {{ 'common.cancel' | translate }}
          </button>
          <h2 class="truncate text-base font-semibold">{{ title() }}</h2>
          <button
            type="button"
            (click)="save.emit()"
            [disabled]="saving()"
            class="text-[15px] font-semibold text-brand-lighter disabled:opacity-50"
          >
            {{ 'common.save' | translate }}
          </button>
        </header>

        <!-- Web header -->
        <header class="hidden shrink-0 items-center justify-between border-b border-border px-[26px] py-5 md:flex">
          <h2 class="text-[19px] font-semibold">{{ title() }}</h2>
          <button
            type="button"
            (click)="closed.emit()"
            class="rounded-md p-1 text-muted hover:text-text"
            [attr.aria-label]="'common.close' | translate"
          >
            <svg lucideX [size]="20"></svg>
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-[18px] pb-[calc(env(safe-area-inset-bottom)+24px)] md:px-[26px] md:py-6">
          <ng-content />
        </div>

        <!-- Web footer -->
        <footer class="hidden shrink-0 justify-end gap-2.5 border-t border-border px-[26px] py-[18px] md:flex">
          <button
            type="button"
            (click)="closed.emit()"
            class="rounded-lg border border-border px-4 py-2.5 text-sm text-text-2 hover:border-border-strong"
          >
            {{ 'common.cancel' | translate }}
          </button>
          <button
            type="button"
            (click)="save.emit()"
            [disabled]="saving()"
            class="rounded-lg bg-brand px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {{ saveLabel() }}
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class ModalSheet {
  readonly title = input.required<string>();
  /** Primary button text on web (mobile always shows "Guardar"). */
  readonly saveLabel = input.required<string>();
  readonly saving = input(false, { transform: booleanAttribute });

  readonly save = output<void>();
  readonly closed = output<void>();

  private readonly document = inject(DOCUMENT);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  constructor() {
    const body = this.document.body;
    const previousOverflow = body.style.overflow;
    const previousFocus = this.document.activeElement as HTMLElement | null;
    body.style.overflow = 'hidden';

    inject(DestroyRef).onDestroy(() => {
      body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    });

    afterNextRender(() => {
      const panel = this.panel().nativeElement;
      const preferred = panel.querySelector<HTMLElement>('[data-autofocus]');
      (preferred && this.isVisible(preferred) ? preferred : this.focusables()[0])?.focus();
    });
  }

  protected onEscape(event: Event): void {
    if (!event.defaultPrevented) {
      event.preventDefault();
      this.closed.emit();
    }
  }

  protected trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }
    const items = this.focusables();
    if (items.length === 0) {
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = this.document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusables(): HTMLElement[] {
    return Array.from(this.panel().nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) =>
      this.isVisible(el),
    );
  }

  private isVisible(el: HTMLElement): boolean {
    return el.getClientRects().length > 0;
  }
}
