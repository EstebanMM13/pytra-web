import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const WIDTH = 60;
const HEIGHT = 18;
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

/** Tiny decorative trend line (no axes). Renders nothing with fewer than 2 points. */
@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block', 'aria-hidden': 'true' },
  template: `
    @if (line(); as l) {
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" [attr.width]="width" [attr.height]="height" class="block overflow-visible">
        <path [attr.d]="l.area" class="fill-brand-light/15 stroke-none" />
        <path
          [attr.d]="l.stroke"
          fill="none"
          class="stroke-brand-light"
          stroke-width="1.5"
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
