import { ChangeDetectionStrategy, booleanAttribute, Component, computed, input, linkedSignal } from '@angular/core';

export type GameCoverSize = 'xs' | 'sm' | 'md' | 'lg' | 'hero' | 'fill';

/** Box size per variant: portrait box art (2:3). `fill` takes the parent's width. */
const SIZE_CLASS: Record<GameCoverSize, string> = {
  xs: 'h-9 w-6 rounded-[3px]',
  sm: 'h-12 w-8 rounded',
  md: 'h-[84px] w-14 rounded-md',
  lg: 'h-[150px] w-[100px] rounded-lg md:h-[216px] md:w-36 md:rounded-xl',
  hero: 'aspect-[2/3] w-28 rounded-lg sm:w-32 md:w-40 md:rounded-xl lg:w-44',
  fill: 'aspect-[2/3] w-full rounded-lg',
};

const INITIALS_TEXT: Record<GameCoverSize, string> = {
  xs: 'text-[8px]',
  sm: 'text-[10px]',
  md: 'text-sm',
  lg: 'text-3xl md:text-4xl',
  hero: 'text-3xl md:text-4xl',
  fill: 'text-3xl',
};

const STEAM_APPS_BASE = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/';

/** Steam's portrait library capsule (600x900) for an appid: the cover Pytra stores for Steam games. */
export function steamPortraitCoverUrl(appId: number | string): string {
  return `${STEAM_APPS_BASE}${appId}/library_600x900.jpg`;
}

const STEAM_LIBRARY_CAPSULE =
  /^(https:\/\/(?:[a-z0-9-]+\.)*steamstatic\.com\/(?:store_item_assets\/)?steam\/apps\/\d+\/)library_600x900(?:_2x)?\.jpg(?:\?.*)?$/i;

/**
 * Some Steam apps (old or small ones) have no library capsule: the same app's landscape store header,
 * or null when `url` is not a Steam library capsule.
 */
export function steamHeaderFallback(url: string): string | null {
  const match = STEAM_LIBRARY_CAPSULE.exec(url);
  return match ? `${match[1]}header.jpg` : null;
}

/** Box art aspect (width / height) the cover boxes are drawn at. */
const PORTRAIT_RATIO = 2 / 3;

/**
 * How far (relative) an image's aspect may be from 2:3 and still be cropped to fill the box.
 * IGDB's 264x374 covers are about 6% off and crop fine; wider gaps (squarish art, landscape headers,
 * very tall images) would lose a visible part of the art, so those are shown whole instead.
 */
export const PORTRAIT_TOLERANCE = 0.08;

/** Whether an image of `width` x `height` is close enough to 2:3 to be cropped (object-cover). */
export function fitsPortraitBox(width: number, height: number, tolerance = PORTRAIT_TOLERANCE): boolean {
  if (!(width > 0) || !(height > 0)) {
    return true;
  }
  return Math.abs(width / height / PORTRAIT_RATIO - 1) <= tolerance;
}

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
 * Game cover as portrait box art (2:3). Lazy-loaded, no referrer. A Steam library capsule that fails
 * to load retries once with the app's store header; art far from 2:3 (that header, a square or a custom url) is
 * shown whole over a blurred copy of itself instead of being cropped to a sliver. With no url, or
 * when loading fails, it renders a gradient (brand tint -> surface, faintly hued from the name) with initials.
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
    @if (src(); as current) {
      @if (letterbox()) {
        <!-- Art far from 2:3: a blurred copy fills the poster, the whole image sits on top. -->
        <img
          [src]="current"
          alt=""
          aria-hidden="true"
          decoding="async"
          referrerpolicy="no-referrer"
          class="absolute inset-0 size-full scale-150 object-cover opacity-70 blur-md"
        />
      }
      <img
        [src]="current"
        [alt]="decorative() ? '' : name()"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        class="relative size-full"
        [class]="letterbox() ? 'object-contain' : 'object-cover'"
        (load)="onLoad($event)"
        (error)="onError(current)"
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

  /** Image being shown: the url, then its Steam header fallback, then null (initials). Resets with the url. */
  protected readonly src = linkedSignal<string | null>(() => this.url() || null);

  /** The loaded image is too far from 2:3 to crop (see `fitsPortraitBox`); resets whenever the url changes. */
  protected readonly letterbox = linkedSignal({ source: this.url, computation: () => false });

  protected readonly initials = computed(() => coverInitials(this.name()));
  protected readonly sizeClass = computed(() => SIZE_CLASS[this.size()]);
  protected readonly initialsText = computed(() => INITIALS_TEXT[this.size()]);
  protected readonly fallbackBackground = computed(() => {
    const hue = coverHue(this.name());
    return (
      `linear-gradient(160deg, color-mix(in srgb, hsl(${hue} 55% 55%) 16%, var(--pt-brand-tint)) 0%, ` +
      `var(--pt-surface) 100%)`
    );
  });

  protected onLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.letterbox.set(!fitsPortraitBox(img.naturalWidth, img.naturalHeight));
  }

  protected onError(failed: string): void {
    this.letterbox.set(false);
    this.src.set(failed === this.url() ? steamHeaderFallback(failed) : null);
  }
}
