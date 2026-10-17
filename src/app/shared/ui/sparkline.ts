import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Drawing box; the SVG stretches it to whatever size the host gets. */
const WIDTH = 120;
const HEIGHT = 24;
const PAD = 1.5;

/**
 * Polyline points for a sparkline in a `width`×`height` box (y grows down, `pad` keeps the
 * stroke inside). Flat series sit in the middle. Returns [] for fewer than 2 values.
 */
export function sparklinePoints(values: readonly number[], width = WIDTH, height = HEIGHT, pad = PAD): [number, number][] {
  if (values.length < 2) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const step = (width - pad * 2) / (values.length - 1);
  return values.map((v, i) => {
    const y = span === 0 ? height / 2 : pad + (1 - (v - min) / span) * (height - pad * 2);
    return [round(pad + i * step), round(y)];
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Decorative trend line (no axes) that fills its host box: size the host (e.g. `h-6 w-full`)
 * and the line stretches to it with a constant stroke width. Renders nothing with < 2 points.
 * On first render the line draws itself in (stroke-dashoffset over a unit `pathLength`) and the
 * area fades in behind it; the dash only lives during the animation, so the resting line is always
 * whole. No motion with reduced motion.
 */
@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', 'aria-hidden': 'true' },
  styles: `
    .spark-line {
      animation: spark-draw 900ms cubic-bezier(0.65, 0, 0.35, 1) backwards;
    }

    .spark-area {
      animation: spark-fade 500ms ease-out 450ms backwards;
    }

    @keyframes spark-draw {
      from {
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
      }
      to {
        stroke-dasharray: 1;
        stroke-dashoffset: 0;
      }
    }

    @keyframes spark-fade {
      from {
        opacity: 0;
      }
    }
  `,
  template: `
    @if (line(); as l) {
      <svg
        [attr.viewBox]="'0 0 ' + width + ' ' + height"
        preserveAspectRatio="none"
        class="block size-full overflow-visible"
      >
        <path [attr.d]="l.area" class="spark-area fill-brand-light/15 stroke-none" />
        <path
          [attr.d]="l.stroke"
          fill="none"
          pathLength="1"
          class="spark-line stroke-brand-light"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    }
  `,
})
export class Sparkline {
  readonly values = input.required<readonly number[]>();
  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;

  protected readonly line = computed(() => {
    const pts = sparklinePoints(this.values());
    if (!pts.length) return null;
    const stroke = 'M' + pts.map(([x, y]) => `${x} ${y}`).join(' L');
    const area = `${stroke} L${pts[pts.length - 1][0]} ${HEIGHT} L${pts[0][0]} ${HEIGHT} Z`;
    return { stroke, area };
  });
}
