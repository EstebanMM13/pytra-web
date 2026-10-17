import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Loading placeholder: size and radius come from host classes, e.g. `class="h-24 rounded-xl"`.
 * A soft highlight sweeps across it (transform only); static with reduced motion.
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block overflow-hidden border border-border bg-surface', 'aria-hidden': 'true' },
  template: '',
  styles: `
    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(
        100deg,
        transparent 20%,
        color-mix(in srgb, var(--pt-text) 7%, transparent) 50%,
        transparent 80%
      );
      animation: skeleton-shimmer 1.4s cubic-bezier(0.42, 0, 0.58, 1) infinite;
    }

    @keyframes skeleton-shimmer {
      to {
        transform: translateX(100%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host::after {
        content: none;
      }
    }
  `,
})
export class Skeleton {}
