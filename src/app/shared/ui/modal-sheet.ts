import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS } from './icons';
import { TranslatePipe } from '@ngx-translate/core';
import { closeOverlay, isTopOverlay, openOverlay } from './overlay-stack';
import { DemoModeService } from '../../core/services/demo-mode.service';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog shell. Web (md+): centred modal (max 720px) over the overlay, fade + 8px rise.
 * Mobile: full-screen sheet sliding up, header "Cancelar · title · Guardar".
 * Handles Escape, a Tab focus trap, body scroll lock and focus restore. The body is projected;
 * the save buttons emit `save` (the content owns validation and submission). `viewOnly` drops them.
 * Read-only demo: the dialog opens normally with a notice, and save shows the demo toast instead of
 * emitting (an inner form submitted with Enter is stopped too), so no dialog ever submits; writes
 * outside dialogs are stopped by the auth interceptor.
 * The host moves to <body> once rendered: an ancestor with a transform, filter or backdrop-filter
 * (e.g. a `card-glass` card) would otherwise turn the fixed overlay into one clipped to that ancestor.
 */
@Component({
  selector: 'app-modal-sheet',
  imports: [TranslatePipe, LucideDynamicIcon],
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
          <button type="button" (click)="cancel()" [disabled]="saving()" class="text-[15px] text-text-3 disabled:opacity-50">
            {{ (viewOnly() ? 'common.close' : 'common.cancel') | translate }}
          </button>
          <h2 class="truncate text-base font-semibold">{{ title() }}</h2>
          @if (viewOnly()) {
            <!-- Keeps the title centred -->
            <span class="invisible text-[15px]" aria-hidden="true">{{ 'common.close' | translate }}</span>
          } @else {
            <button
              type="button"
              (click)="onSave()"
              [disabled]="saving() || saveDisabled()"
              class="text-[15px] font-semibold disabled:opacity-50"
              [class]="danger() ? 'text-danger' : 'text-brand-lighter'"
            >
              {{ danger() ? saveLabel() : ('common.save' | translate) }}
            </button>
          }
        </header>

        <!-- Web header -->
        <header class="hidden shrink-0 items-center justify-between gap-4 border-b border-border px-[26px] py-5 md:flex">
          <h2 class="min-w-0 truncate text-[19px] font-semibold" [attr.title]="title()">{{ title() }}</h2>
          <button
            type="button"
            (click)="cancel()" [disabled]="saving()"
            class="shrink-0 rounded-md p-1 text-muted hover:text-text disabled:opacity-50"
            [attr.aria-label]="'common.close' | translate"
          >
            <svg [lucideIcon]="icons.x" [size]="20"></svg>
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-[18px] pb-[calc(env(safe-area-inset-bottom)+24px)] md:px-[26px] md:py-6">
          @if (demoNotice()) {
            <p
              class="mb-4 flex items-center gap-2 rounded-lg border border-gold-card-border bg-gold-tint px-3 py-2 text-xs text-gold-tint-fg"
              role="note"
              data-demo-notice
            >
              <svg [lucideIcon]="icons.eye" [size]="14" class="shrink-0" aria-hidden="true"></svg>
              {{ 'demo.dialogNotice' | translate }}
            </p>
          }
          <ng-content />
        </div>

        <!-- Web footer (view-only sheets close from the header) -->
        @if (!viewOnly()) {
          <footer class="hidden shrink-0 justify-end gap-2.5 border-t border-border px-[26px] py-[18px] md:flex">
            <button
              type="button"
              (click)="cancel()" [disabled]="saving()"
              class="rounded-lg border border-border px-4 py-2.5 text-sm text-text-2 hover:border-border-strong disabled:opacity-50"
            >
              {{ 'common.cancel' | translate }}
            </button>
            <button
              type="button"
              (click)="onSave()"
              [disabled]="saving() || saveDisabled()"
              class="rounded-lg px-[18px] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              [class]="danger() ? 'bg-danger-solid hover:opacity-90' : 'bg-brand hover:bg-brand-dark'"
            >
              {{ saveLabel() }}
            </button>
          </footer>
        }
      </div>
    </div>
  `,
})
export class ModalSheet {
  protected readonly icons = ICONS;

  readonly title = input.required<string>();
  /** Primary button text on web (mobile always shows "Guardar"). Unused when `viewOnly`. */
  readonly saveLabel = input<string>('');
  /** Nothing to save (e.g. an enlarged chart): no save buttons, "Cerrar" instead of "Cancelar". */
  readonly viewOnly = input(false, { transform: booleanAttribute });
  readonly saving = input(false, { transform: booleanAttribute });
  /** Destructive action: red primary button, and its label (not "Guardar") in the mobile header. */
  readonly danger = input(false, { transform: booleanAttribute });
  /** Disables the primary action (e.g. until a confirmation is typed). */
  readonly saveDisabled = input(false, { transform: booleanAttribute });

  readonly save = output<void>();
  readonly closed = output<void>();

  private readonly demoMode = inject(DemoModeService);
  protected readonly demoNotice = computed(() => this.demoMode.isDemo() && !this.viewOnly());

  private readonly document = inject(DOCUMENT);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  constructor() {
    const body = this.document.body;
    const previousFocus = this.document.activeElement as HTMLElement | null;
    openOverlay(this, body);

    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

    // Demo: a form inside the sheet submitted with Enter must stop like the save button does. A
    // capture listener on the host runs before the form's own (ngSubmit) and keeps it from firing.
    const onSubmit = (event: Event) => {
      if (!this.viewOnly() && this.demoMode.isDemo()) {
        event.preventDefault();
        event.stopPropagation();
        this.demoMode.blockWrite();
      }
    };
    host.addEventListener('submit', onSubmit, true);

    inject(DestroyRef).onDestroy(() => {
      // Angular also removes the host on destroy; this covers a host already moved to <body>.
      host.removeEventListener('submit', onSubmit, true);
      host.remove();
      closeOverlay(this, body);
      previousFocus?.focus?.();
    });

    afterNextRender(() => {
      // After the first render: the host is in the DOM only once its parent view was inserted.
      if (host.parentNode !== body) {
        body.appendChild(host);
      }
      const panel = this.panel().nativeElement;
      const preferred = panel.querySelector<HTMLElement>('[data-autofocus]');
      (preferred && this.isVisible(preferred) ? preferred : this.focusables()[0])?.focus();
    });
  }

  /** Only the topmost open sheet closes on Escape (a sheet opened from another one closes first). */
  protected onEscape(event: Event): void {
    if (!event.defaultPrevented && isTopOverlay(this)) {
      event.preventDefault();
      this.cancel();
    }
  }

  protected onSave(): void {
    if (!this.demoMode.blockWrite()) {
      this.save.emit();
    }
  }

  /** Closing mid-save would drop the request's outcome (and its error), so it waits. */
  protected cancel(): void {
    if (!this.saving()) {
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
