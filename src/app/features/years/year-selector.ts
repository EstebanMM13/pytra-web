import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
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
import { adjacentYears } from './years.logic';

/**
 * Phone version of the year tabs: "‹ 2026 ›" (older / newer, disabled at the ends). Tapping the
 * year opens a bottom sheet listing every year, like the library status picker.
 */
@Component({
  selector: 'app-year-selector',
  imports: [TranslatePipe, LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(document:keydown.escape)': 'onEscape($event)' },
  template: `
    <div class="flex items-center justify-between gap-2 font-mono">
      <button
        type="button"
        (click)="go(neighbours().older)"
        [disabled]="neighbours().older === null"
        class="grid size-10 place-items-center rounded-full border border-border text-text-2 disabled:opacity-35"
        [attr.aria-label]="'years.prevYear' | translate"
        data-year-older
      >
        <svg [lucideIcon]="icons.chevronLeft" [size]="18" aria-hidden="true"></svg>
      </button>

      <button
        #trigger
        type="button"
        (click)="openSheet()"
        [disabled]="years().length < 2"
        class="flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[17px] font-semibold text-brand-lighter"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="('years.pickYear' | translate) + ': ' + (year() ?? '')"
        data-year-trigger
      >
        {{ year() }}
        @if (years().length > 1) {
          <svg [lucideIcon]="icons.chevronDown" [size]="14" class="text-faint" aria-hidden="true"></svg>
        }
      </button>

      <button
        type="button"
        (click)="go(neighbours().newer)"
        [disabled]="neighbours().newer === null"
        class="grid size-10 place-items-center rounded-full border border-border text-text-2 disabled:opacity-35"
        [attr.aria-label]="'years.nextYear' | translate"
        data-year-newer
      >
        <svg [lucideIcon]="icons.chevronRight" [size]="18" aria-hidden="true"></svg>
      </button>
    </div>

    @if (open()) {
      <div class="fixed inset-0 z-40 bg-black/50" (click)="close()" aria-hidden="true"></div>
      <div
        #panel
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        (keydown)="onKeydown($event)"
        [attr.aria-label]="'years.pickYear' | translate"
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] animate-modal-in flex-col overflow-y-auto rounded-t-2xl border-t border-border bg-surface px-3 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]"
      >
        <h2 class="px-2 pb-2 text-[15px] font-semibold">{{ 'years.pickYear' | translate }}</h2>
        <div role="radiogroup" [attr.aria-label]="'years.pickYear' | translate" class="flex flex-col font-mono">
          @for (y of years(); track y) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="y === year()"
              (click)="pick(y)"
              class="flex min-h-12 items-center gap-3 rounded-lg px-3 text-left text-[15px]"
              [class]="y === year() ? 'bg-brand-tint text-brand-lighter' : 'text-text-2'"
            >
              <span class="flex-1">{{ y }}</span>
              <svg
                [lucideIcon]="icons.check"
                [size]="16"
                class="shrink-0"
                [class.invisible]="y !== year()"
                aria-hidden="true"
              ></svg>
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class YearSelector {
  protected readonly icons = ICONS;
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** Every year, most recent first (same list as the desktop tabs). */
  readonly years = input.required<readonly number[]>();
  readonly year = input.required<number | null>();
  readonly yearChange = output<number>();

  protected readonly open = signal(false);
  protected readonly neighbours = computed(() => adjacentYears(this.years(), this.year()));

  constructor() {
    inject(DestroyRef).onDestroy(() => closeOverlay(this, this.document.body));
  }

  protected go(year: number | null): void {
    if (year !== null) this.yearChange.emit(year);
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

  protected pick(year: number): void {
    if (year !== this.year()) this.yearChange.emit(year);
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
