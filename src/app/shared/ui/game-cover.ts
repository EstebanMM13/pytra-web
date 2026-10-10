import { ChangeDetectionStrategy, booleanAttribute, Component, computed, input, linkedSignal } from '@angular/core';

export type GameCoverSize = 'xs' | 'sm' | 'md' | 'lg' | 'fill';

/** Box size per variant; all keep Steam's ~2.14:1 header aspect except `fill` (parent decides). */
const SIZE_CLASS: Record<GameCoverSize, string> = {
  xs: 'h-5 w-[43px] rounded',
  sm: 'h-[30px] w-16 rounded-md',
  md: 'h-[52px] w-28 rounded-lg',
  lg: 'h-[76px] w-[162px] rounded-lg md:h-[108px] md:w-[230px] md:rounded-xl',
  fill: 'size-full',
};

const INITIALS_TEXT: Record<GameCoverSize, string> = {
  xs: 'text-[9px]',
  sm: 'text-[11px]',
  md: 'text-base',
  lg: 'text-2xl md:text-3xl',
  fill: 'text-3xl',
};

/** Up to two initials from the first words of a name (ignores punctuation-only tokens). */
export function coverInitials(name: string): string {
  const words = name
    .split(/[\s:\-–—_/]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Deterministic hue (0-359) from a name, used to tint the fallback subtly. */
export function coverHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/**
 * Game cover image (Steam header style). Lazy-loaded, no referrer; when the url is missing or fails
 * to load it renders a gradient (brand tint -> surface, faintly hued from the name) with initials.
 */
@Component({
  selector: 'app-game-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block shrink-0 overflow-hidden bg-surface',
    '[attr.aria-hidden]': 'decorative() || null',
    '[class]': 'sizeClass()',
  },
  template: `
    @if (showImage()) {
      <img
        [src]="url()"
        [alt]="decorative() ? '' : name()"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        class="size-full object-cover"
        (error)="failed.set(true)"
      />
    } @else {
      <div
        class="flex size-full items-center justify-center"
        [style.background]="fallbackBackground()"
        [attr.role]="decorative() ? null : 'img'"
        [attr.aria-label]="decorative() ? null : name()"
      >
        <span
          class="font-semibold tracking-wide text-brand-lighter select-none"
          [class]="initialsText()"
          aria-hidden="true"
          >{{ initials() }}</span
        >
      </div>
    }
  `,
})
export class GameCover {
  readonly url = input<string | null | undefined>(null);
  readonly name = input.required<string>();
  readonly size = input<GameCoverSize>('sm');
  /** Next to a visible game name: hide from assistive tech instead of repeating the name. */
  readonly decorative = input(false, { transform: booleanAttribute });

  /** Load error of the current url; resets whenever the url changes. */
  protected readonly failed = linkedSignal({ source: this.url, computation: () => false });

  protected readonly showImage = computed(() => !!this.url() && !this.failed());
  protected readonly initials = computed(() => coverInitials(this.name()));
  protected readonly sizeClass = computed(() => SIZE_CLASS[this.size()]);
  protected readonly initialsText = computed(() => INITIALS_TEXT[this.size()]);
  protected readonly fallbackBackground = computed(() => {
    const hue = coverHue(this.name());
    return (
      `linear-gradient(135deg, color-mix(in srgb, hsl(${hue} 55% 55%) 14%, var(--pt-brand-tint)) 0%, ` +
      `var(--pt-surface) 100%)`
    );
  });
}
