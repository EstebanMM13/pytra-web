import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Pytra symbol: rounded play with a 3-bar chart cut out and a gold 4th bar.
 * The bars are holes (evenodd sub-paths, same geometry as the handoff's mask) so the symbol
 * works on any background without per-instance mask ids. Theme-aware: play #9D7CFF dark /
 * #724DCE light via `currentColor`, gold bar #E2AE5F dark / #C98D3A light.
 * Size it with width/height classes on the host.
 */
@Component({
  selector: 'app-pytra-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block shrink-0 text-[#9D7CFF] light:text-[#724DCE]', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 100 100" class="block size-full" focusable="false">
      <path
        fill="currentColor"
        fill-rule="evenodd"
        d="M22 12 Q14 8 14 18 V82 Q14 92 22 88 L86 56 Q94 50 86 44 Z
           M28 58h5a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-16a2 2 0 0 1 2-2Z
           M41 48h5a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-20a2 2 0 0 1 2-2Z
           M54 40h5a2 2 0 0 1 2 2v21a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-21a2 2 0 0 1 2-2Z"
      />
      <rect x="65" y="42" width="9" height="16" rx="2" class="fill-[#E2AE5F] light:fill-[#C98D3A]" />
    </svg>
  `,
})
export class PytraMark {}
