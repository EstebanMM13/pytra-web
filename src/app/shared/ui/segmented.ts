import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Box of the sliding highlight, in px from the control's padding edge. */
export interface SegmentIndicatorBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where the highlight sits behind `option`; null when it is missing or not laid out (hidden, jsdom). */
export function segmentIndicatorBox(
  option: Pick<HTMLElement, 'offsetLeft' | 'offsetTop' | 'offsetWidth' | 'offsetHeight'> | null | undefined,
): SegmentIndicatorBox | null {
  if (!option || !(option.offsetWidth > 0) || !(option.offsetHeight > 0)) return null;
  return { x: option.offsetLeft, y: option.offsetTop, width: option.offsetWidth, height: option.offsetHeight };
}

export interface SegmentedOption<T extends string = string> {
  value: T;
  /** Translation key (plain text also renders as-is). */
  label: string;
}

/**
 * Segmented control. `tone="neutral"` is the quieter variant (library toolbar,
 * small card headers); the default highlights the active option in brand tint.
 *
 * The highlight is one element that slides to the picked option (transform + size, scaled by
 * `--pt-motion`, so it jumps with reduced motion). Until it has been measured (first paint, jsdom),
 * the active button paints its own background instead.
 */
@Component({
  selector: 'app-segmented',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'radiogroup',
    '[class]': 'hostClass()',
  },
  styles: `
    [data-segment-indicator][data-ready] {
      transition-property: transform, width, height;
      transition-duration: calc(240ms * var(--pt-motion, 1));
      transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
    }
  `,
  template: `
    <span
      #indicator
      aria-hidden="true"
      data-segment-indicator
      class="pointer-events-none absolute top-0 left-0"
      [class]="indicatorClass()"
      [class.invisible]="!measured()"
    ></span>
    @for (option of options(); track option.value) {
      <button
        #option
        type="button"
        role="radio"
        [attr.aria-checked]="option.value === value()"
        (click)="value.set(option.value)"
        [class]="optionClass(option.value === value())"
      >
        {{ option.label | translate }}
      </button>
    }
  `,
})
export class Segmented<T extends string = string> {
  readonly options = input.required<readonly SegmentedOption<T>[]>();
  readonly value = model.required<T>();
  readonly tone = input<'brand' | 'neutral'>('brand');
  readonly size = input<'sm' | 'md'>('md');
  /** Fill the available width with equal-width options (forms). */
  readonly stretch = input(false, { transform: booleanAttribute });

  // Class bindings are built as plain strings: Angular's array form treats each
  // entry as a single class name, so entries containing spaces break styling.
  /** The sliding highlight has been placed: buttons stop painting their own active background. */
  protected readonly measured = signal(false);

  private readonly indicator = viewChild.required<ElementRef<HTMLElement>>('indicator');
  private readonly optionButtons = viewChildren<ElementRef<HTMLButtonElement>>('option');
  private readyFrame = 0;

  constructor() {
    // Re-place after every render that changes the pick or the options (no extra change detection:
    // the indicator is styled directly).
    afterRenderEffect(() => {
      this.value();
      this.options();
      this.optionButtons();
      this.place(true);
    });
    // Size changes (fonts loading, translations, viewport) move the option without a pick: snap there.
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.place(false)) : null;
    const host: HTMLElement = inject(ElementRef).nativeElement;
    afterRenderEffect(() => {
      resize?.disconnect();
      resize?.observe(host);
      for (const button of this.optionButtons()) resize?.observe(button.nativeElement);
    });
    inject(DestroyRef).onDestroy(() => {
      resize?.disconnect();
      if (this.readyFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.readyFrame);
    });
  }

  private place(animate: boolean): void {
    const index = this.options().findIndex((option) => option.value === this.value());
    const box = segmentIndicatorBox(this.optionButtons()[index]?.nativeElement);
    const el = this.indicator().nativeElement;
    if (!box) {
      this.measured.set(false);
      return;
    }
    // First placement and resizes jump; picks after that slide.
    if (!animate || !this.measured()) {
      el.removeAttribute('data-ready');
      this.scheduleReady(el);
    }
    el.style.transform = `translate(${box.x}px, ${box.y}px)`;
    el.style.width = `${box.width}px`;
    el.style.height = `${box.height}px`;
    this.measured.set(true);
  }

  /** Enables the slide one frame after a jump, so the jump itself is never animated. */
  private scheduleReady(el: HTMLElement): void {
    if (typeof requestAnimationFrame !== 'function') return;
    if (this.readyFrame) cancelAnimationFrame(this.readyFrame);
    this.readyFrame = requestAnimationFrame(() => {
      this.readyFrame = 0;
      el.setAttribute('data-ready', '');
    });
  }

  protected readonly indicatorClass = computed(() =>
    [
      this.size() === 'sm' ? 'rounded-[5px]' : 'rounded-md',
      this.tone() === 'neutral' ? 'bg-border' : 'bg-brand-tint',
    ].join(' '),
  );

  protected readonly hostClass = computed(() =>
    [
      'relative shrink-0 border border-border bg-bg',
      this.size() === 'sm' ? 'rounded-[7px] p-0.5' : 'rounded-lg p-[3px]',
      // Four or more stretched options wrap into two columns on phones, so labels never truncate
      // (narrow screens or a large system font size).
      this.stretch() ? (this.options().length > 3 ? 'grid w-full grid-cols-2 gap-0.5 sm:flex sm:gap-0' : 'flex w-full') : 'inline-flex',
    ].join(' '),
  );

  protected optionClass(active: boolean): string {
    const ownBackground = !this.measured();
    return [
      // Above the sliding highlight.
      'relative font-medium whitespace-nowrap',
      // Stretched options share the width equally but never shrink below their label (no truncation:
      // a longer label takes the room it needs at a large system font size). Touch hit area: they
      // grow to 40px on coarse pointers instead of taking the invisible tap-area overlay.
      this.stretch() ? 'flex-1 pointer-coarse:min-h-10' : 'tap-area',
      this.size() === 'sm' ? 'rounded-[5px] px-2 py-[3px] text-xs' : 'rounded-md py-1.5 text-label',
      // Stretched options share narrow widths (4 statuses on a phone): tighter padding keeps labels whole.
      this.size() === 'sm' ? '' : this.stretch() ? 'px-2' : 'px-3',
      active
        ? this.tone() === 'neutral'
          ? `${ownBackground ? 'bg-border ' : ''}text-text`
          : `${ownBackground ? 'bg-brand-tint ' : ''}text-brand-lighter`
        : 'text-muted hover:text-text-2',
    ].join(' ');
  }
}
