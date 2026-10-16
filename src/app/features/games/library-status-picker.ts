import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { ICONS } from '../../shared/ui/icons';
import { closeOverlay, isTopOverlay, openOverlay, trapTab } from '../../shared/ui/overlay-stack';
import { LibraryStatusFilter } from './library.logic';

/**
 * Phone version of the library's status pills: one compact button ("Estado: En curso (3)") that
 * opens a bottom sheet listing every status with its count. Picking one applies it and closes.
 */
@Component({
  selector: 'app-library-status-picker',
  imports: [TranslatePipe, LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(document:keydown.escape)': 'onEscape($event)' },
  template: `
    <button
      #trigger
      type="button"
      (click)="openSheet()"
      class="flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-[13px] font-medium whitespace-nowrap text-text-2"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      data-status-trigger
    >
      <span class="text-muted">{{ 'library.statusShort' | translate }}:</span>
      <span class="text-brand-lighter">{{ 'library.status.' + status() | translate }}</span>
      <span class="font-mono text-[11px] opacity-70">({{ counts()[status()] }})</span>
      <svg [lucideIcon]="icons.chevronDown" [size]="14" class="text-faint"></svg>
    </button>

    @if (open()) {
      <div class="fixed inset-0 z-40 bg-black/50" (click)="close()" aria-hidden="true"></div>
      <div
        #panel
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        (keydown)="onKeydown($event)"
        [attr.aria-label]="'library.statusLabel' | translate"
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] animate-modal-in flex-col overflow-y-auto rounded-t-2xl border-t border-border bg-surface px-3 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]"
      >
        <h2 class="px-2 pb-2 text-[15px] font-semibold">{{ 'library.statusLabel' | translate }}</h2>
        <div role="radiogroup" [attr.aria-label]="'library.statusLabel' | translate" class="flex flex-col">
          @for (s of statuses(); track s) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="s === status()"
              (click)="pick(s)"
              class="flex min-h-12 items-center gap-3 rounded-lg px-3 text-left text-[15px]"
              [class]="s === status() ? 'bg-brand-tint text-brand-lighter' : 'text-text-2'"
            >
              <span class="flex-1">{{ 'library.status.' + s | translate }}</span>
              <span class="font-mono text-[13px] opacity-70">{{ counts()[s] }}</span>
              <svg
                [lucideIcon]="icons.check"
                [size]="16"
                class="shrink-0"
                [class.invisible]="s !== status()"
                aria-hidden="true"
              ></svg>
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class LibraryStatusPicker {
  protected readonly icons = ICONS;
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  readonly statuses = input.required<readonly LibraryStatusFilter[]>();
  readonly status = input.required<LibraryStatusFilter>();
  readonly counts = input.required<Record<LibraryStatusFilter, number>>();
  readonly statusChange = output<LibraryStatusFilter>();

  protected readonly open = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => closeOverlay(this, this.document.body));
  }

  protected openSheet(): void {
    this.open.set(true);
    // Shared with the modal sheets: one scroll lock and one Escape stack for every overlay.
    openOverlay(this, this.document.body);
    afterNextRender(
      () => this.panel()?.nativeElement.querySelector<HTMLElement>('[aria-checked="true"]')?.focus?.(),
      { injector: this.injector },
    );
  }

  protected pick(status: LibraryStatusFilter): void {
    this.statusChange.emit(status);
    this.close();
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    closeOverlay(this, this.document.body);
    this.trigger().nativeElement.focus?.();
  }

  protected onEscape(event: Event): void {
    if (this.open() && !event.defaultPrevented && isTopOverlay(this)) {
      event.preventDefault();
      this.close();
    }
  }

  /** Tab stays inside the sheet while it is open. */
  protected onKeydown(event: KeyboardEvent): void {
    const panel = this.panel()?.nativeElement;
    if (panel) trapTab(event, panel, Array.from(panel.querySelectorAll<HTMLElement>('button')));
  }
}
