import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { donutArcs } from './stats.logic';

/** Gap between neighbouring arcs, as a fraction of the circle. */
const ARC_GAP = 0.012;

/**
 * Share ring (plain SVG, no chart library): one arc per slice, clockwise from the top, over a
 * faint track that shows when nothing is drawn. The projected content sits in the hole (a
 * headline figure). Size it with host classes (e.g. `size-32`); the stroke scales with it.
 * Decorative: the caller gives the figures as text next to it. Arcs sweep in on first render
 * (none with reduced motion, src/motion.css).
 */
@Component({
  selector: 'app-stats-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block shrink-0' },
  styles: `
    .donut-arc {
      animation: donut-sweep 800ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
    }

    @keyframes donut-sweep {
      from {
        stroke-dasharray: 0 100;
      }
    }
  `,
  template: `
    <svg viewBox="0 0 100 100" class="block size-full -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--pt-hover)" [attr.stroke-width]="thickness()" />
      @for (arc of arcs(); track arc.key) {
        <circle
          class="donut-arc"
          cx="50"
          cy="50"
          r="42"
          fill="none"
          pathLength="100"
          [attr.stroke]="arc.color"
          [attr.stroke-width]="thickness()"
          [style.stroke-dasharray]="arc.length * 100 + ' 100'"
          [style.stroke-dashoffset]="-arc.start * 100"
          data-donut-arc
        />
      }
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center text-center" [style.padding.%]="thickness() + 6">
      <ng-content />
    </div>
  `,
})
export class StatsDonut {
  /** Slices in drawing order; their shares (0..1) should add up to 1 (less leaves track showing). */
  readonly slices = input.required<readonly { key: string | number; color: string; share: number }[]>();
  /** Ring width in viewBox units (the circle is 100 wide). */
  readonly thickness = input(12);
  protected readonly arcs = computed(() => donutArcs(this.slices(), ARC_GAP));
}
