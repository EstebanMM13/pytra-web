import {
  ChangeDetectionStrategy,
  booleanAttribute,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';

/** Label + big figure tile. `compact` is the mobile mini-stat variant (value first, no icon). */
@Component({
  selector: 'app-stat-card',
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 rounded-xl border border-card-border card-glass' },
  template: `
    @if (compact()) {
      <div class="p-3">
        <p class="truncate text-xl font-semibold" [class]="valueClass()">{{ display() }}</p>
        <p class="mt-0.5 truncate text-xs text-muted">{{ label() }}</p>
      </div>
    } @else {
      <div class="px-[18px] py-4">
        <p class="flex items-center gap-2 text-[13px] text-muted">
          @if (icon(); as i) {
            <svg [lucideIcon]="i" [size]="15" class="shrink-0 text-brand-light"></svg>
          }
          <span class="truncate">{{ label() }}</span>
        </p>
        <p
          class="mt-3 truncate text-[26px] font-semibold tracking-[-0.02em] lg:text-[28px]"
          [class]="valueClass()"
        >
          {{ display() }}
        </p>
        @if (hint()) {
          <p class="mt-1 truncate text-xs text-muted" [attr.title]="hint()">{{ hint() }}</p>
        }
      </div>
    }
  `,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input<LucideIconInput | null>(null);
  /** Extra classes for the figure, e.g. `font-mono text-gold` for ratings. */
  readonly valueClass = input('');
  /** Optional small line under the value, e.g. a breakdown. */
  readonly hint = input<string | null>(null);
  readonly compact = input(false, { transform: booleanAttribute });

  /** Text on screen: the exact formatted value, or an intermediate count-up frame. */
  protected readonly display = signal('');
  private animated = false;
  private frame = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelFrame(this.frame));
    effect(() => {
      const value = this.value();
      untracked(() => this.render(value));
    });
  }

  private render(value: string | number): void {
    const final = String(value);
    cancelFrame(this.frame);
    const parsed = this.animated ? null : parseCountUp(final);
    this.animated = true;
    if (!parsed || parsed.target === 0 || !canAnimate()) {
      this.display.set(final);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      if (t >= 1) {
        this.display.set(final);
        return;
      }
      const eased = 1 - Math.pow(1 - t, 3);
      this.display.set(parsed.format(parsed.target * eased));
      this.frame = requestAnimationFrame(step);
    };
    this.display.set(parsed.format(0));
    this.frame = requestAnimationFrame(step);
  }
}

const COUNT_UP_MS = 600;

/**
 * Numeric figures the count-up understands: plain integers/decimals with an optional
 * unit suffix ("42", "9.25", "112,9 h"). Anything else (grouped numbers, "3 / 10", "—") renders as-is.
 */
const COUNT_UP_PATTERN = /^(\d+)(?:([.,])(\d+))?(\s*h)?$/;

export function parseCountUp(
  text: string,
): { target: number; format: (n: number) => string } | null {
  const match = COUNT_UP_PATTERN.exec(text);
  if (!match) return null;
  const [, int, sep = '', frac = '', suffix = ''] = match;
  const decimals = frac.length;
  return {
    target: Number(`${int}.${frac || '0'}`),
    format: (n) => n.toFixed(decimals).replace('.', sep) + suffix,
  };
}

function canAnimate(): boolean {
  return (
    typeof requestAnimationFrame === 'function' &&
    typeof matchMedia === 'function' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function cancelFrame(id: number): void {
  if (id && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
}
