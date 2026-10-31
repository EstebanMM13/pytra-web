import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Per-instance ids: a page can show the Pytriarca more than once. */
let seq = 0;

/**
 * Pytriarca (legend) trophy, design 4a: the Pytra play mark in platinum on a two-step plinth,
 * three bars cut out, the fourth bar white, plus a sparkle. Filled artwork (not a stroke icon),
 * so it lives outside ICONS. Source: pytra-datos/iconos v3/pytriarca.svg.
 */
@Component({
  selector: 'app-legend-trophy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 48 48" focusable="false" style="display:block">
      <defs>
        <linearGradient [attr.id]="gradId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f7fafd" />
          <stop offset="0.55" stop-color="#c3cdd9" />
          <stop offset="1" stop-color="#7f8c9e" />
        </linearGradient>
        <mask [attr.id]="maskId" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#fff" />
          <rect x="26" y="58" width="9" height="20" rx="2" />
          <rect x="39" y="48" width="9" height="24" rx="2" />
          <rect x="52" y="40" width="9" height="25" rx="2" />
        </mask>
      </defs>
      <g transform="translate(6 -1) scale(0.34)">
        <path d="M22 12 Q14 8 14 18 V82 Q14 92 22 88 L86 56 Q94 50 86 44 Z" [attr.fill]="'url(#' + gradId + ')'" [attr.mask]="'url(#' + maskId + ')'" />
        <rect x="65" y="42" width="9" height="16" rx="2" fill="#fff" />
      </g>
      <path d="M11.5 29.5h6l1.5 3.5h-9z M12.5 33h23l2.5 3.5h-28z M8 38.5h32l2.5 2.5v5h-37v-5z" [attr.fill]="'url(#' + gradId + ')'" />
      @if (size() >= 28) {
        <path d="M41 3.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" fill="#fff" />
      }
    </svg>
  `,
})
export class LegendTrophy {
  /** Rendered px. The chip uses 28 (compact) / 34 (regular); the sparkle drops below 28. */
  readonly size = input(34);
  protected readonly gradId = `pt-legend-plat-${++seq}`;
  protected readonly maskId = `pt-legend-bars-${seq}`;
}
