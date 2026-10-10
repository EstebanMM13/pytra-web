import {
  ChangeDetectionStrategy,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { Sparkline } from './sparkline';

/** Label + big figure tile. `compact` is the mobile mini-stat variant (value first, no icon). */
@Component({
  selector: 'app-stat-card',
  imports: [LucideDynamicIcon, Sparkline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 rounded-xl border border-card-border card-glass' },
  template: `
    @if (compact()) {
      <!-- Mobile: centred, and long values shrink instead of being cut with "…" -->
      <div class="flex h-full flex-col items-center justify-center p-3 text-center">
        <p
          class="text-xl leading-tight font-bold tracking-[-0.02em] break-words"
          [class]="figureClass()"
          [style.font-size.px]="display().toString().length > 6 ? 16 : null"
        >{{ display() }}</p>
        <p class="mt-0.5 text-xs leading-tight text-muted">{{ label() }}</p>
        @if (hasTrend()) {
          <app-sparkline class="mx-auto mt-1.5 block" [values]="trend()!" />
        }
      </div>
    } @else {
      <div class="px-[18px] py-4">
        <p class="flex items-center gap-2 text-[13px] text-muted">
          @if (icon(); as i) {
            <svg [lucideIcon]="i" [size]="15" class="shrink-0 text-brand-light"></svg>
          }
          <span class="truncate">{{ label() }}</span>
        </p>
        <div class="mt-3 flex items-end justify-between gap-2">
          <p
            class="min-w-0 truncate text-[26px] font-bold tracking-[-0.03em] lg:text-[28px]"
            [class]="figureClass()"
          >
            {{ display() }}
          </p>
          @if (hasTrend()) {
            <app-sparkline class="mb-2 shrink-0" [values]="trend()!" />
          }
        </div>
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
  /** Optional series (oldest first) drawn as a tiny sparkline next to the value; hidden with < 2 points. */
  readonly trend = input<readonly number[] | null>(null);

  protected readonly hasTrend = computed(() => (this.trend()?.length ?? 0) >= 2);
  /** Toned figures (ratings) keep their color with a brand hint; plain ones get the brand gradient. */
  protected readonly figureClass = computed(() => {
    const extra = this.valueClass();
    return extra ? `${extra} text-figure-tone` : 'text-figure';
  });

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
