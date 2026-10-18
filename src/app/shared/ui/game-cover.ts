import {
  ChangeDetectionStrategy,
  booleanAttribute,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { API_ORIGIN } from '../../core/api-base-url';

export type GameCoverSize = 'xs' | 'sm' | 'md' | 'lg' | 'hero' | 'fill';

/**
 * Box size per variant: portrait box art at IGDB's cover ratio (264x374, ~0.706), so IGDB covers fit
 * uncropped and Steam's 2:3 capsules lose only a sliver. Fixed variants keep explicit heights (a
 * stretched flex item would ignore `aspect-ratio`) with widths derived from the ratio; `hero` and
 * `fill` take a width and let the ratio set the height.
 */
const SIZE_CLASS: Record<GameCoverSize, string> = {
  xs: 'h-9 w-[1.59rem] rounded-[3px]',
  sm: 'h-12 w-[2.12rem] rounded',
  md: 'h-[84px] w-[59px] rounded-md',
  lg: 'h-[150px] w-[106px] rounded-lg md:h-[216px] md:w-[152px] md:rounded-xl',
  hero: 'aspect-[264/374] w-28 rounded-lg sm:w-32 md:w-40 md:rounded-xl lg:w-44',
  fill: 'aspect-[264/374] w-full rounded-lg',
};

const INITIALS_TEXT: Record<GameCoverSize, string> = {
  xs: 'text-[8px]',
  sm: 'text-[10px]',
  md: 'text-sm',
  lg: 'text-3xl md:text-4xl',
  hero: 'text-3xl md:text-4xl',
  fill: 'text-3xl',
};

/** Image variant per box: `small` for boxes up to ~90px wide, `big` (the url as stored) otherwise. */
export type CoverImageVariant = 'small' | 'big';

/** IGDB size for small boxes: `t_cover_small_2x` (180x256) is retina-safe up to ~90px wide. */
const IGDB_SMALL_SIZE = 't_cover_small_2x';

/** IGDB sizes already no bigger than `IGDB_SMALL_SIZE`: never swapped for it. */
const IGDB_SMALL_SIZES = new Set([
  't_cover_small',
  't_cover_small_2x',
  't_thumb',
  't_thumb_2x',
  't_micro',
  't_micro_2x',
]);

/** Image variant per box: small boxes (<= ~90px wide) fetch the small IGDB cover. */
const SIZE_VARIANT: Record<GameCoverSize, CoverImageVariant> = {
  xs: 'small',
  sm: 'small',
  md: 'small',
  lg: 'big',
  hero: 'big',
  fill: 'big',
};

/** The `/t_<size>/` segment of an images.igdb.com url. */
const IGDB_IMAGE_SIZE = /^((?:https?:)?\/\/images\.igdb\.com\/igdb\/image\/upload\/)(t_[a-z0-9_]+)\//i;

/** Width the API thumbnails Steam capsules to for small boxes: retina-safe up to ~90px wide. */
const STEAM_THUMB_WIDTH = 180;

/**
 * The url sized for `variant`: for `small`, a larger IGDB image (e.g. `t_cover_big`) is swapped for
 * `t_cover_small_2x` by rewriting its `/t_<size>/` segment, and a Steam library capsule (600x900,
 * ~60 KB; Steam has no small portrait) goes through the API's thumbnail endpoint. `big`,
 * already-small IGDB images and any other url (custom) are returned unchanged. If the thumbnail
 * fails, the cover falls back to the original url (see `nextCoverSource`).
 */
export function sizedCoverUrl(url: string | null | undefined, variant: CoverImageVariant): string | null {
  if (!url) return null;
  if (variant === 'big') return url;
  if (STEAM_LIBRARY_CAPSULE.test(url)) {
    return `${API_ORIGIN}/api/v1/covers/thumb?url=${encodeURIComponent(url)}&w=${STEAM_THUMB_WIDTH}`;
  }
  return url.replace(IGDB_IMAGE_SIZE, (segment, base: string, size: string) =>
    IGDB_SMALL_SIZES.has(size.toLowerCase()) ? segment : `${base}${IGDB_SMALL_SIZE}/`,
  );
}

const STEAM_APPS_BASE = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/';

/** Steam's portrait library capsule (600x900) for an appid: the cover Pytra stores for Steam games. */
export function steamPortraitCoverUrl(appId: number | string): string {
  return `${STEAM_APPS_BASE}${appId}/library_600x900.jpg`;
}

/** A Steam library capsule on Steam's CDNs (steamstatic, or the older steamcdn-a.akamaihd.net). */
const STEAM_LIBRARY_CAPSULE =
  /^(https:\/\/(?:(?:[a-z0-9-]+\.)*steamstatic\.com|steamcdn-a\.akamaihd\.net)\/(?:store_item_assets\/)?steam\/apps\/\d+\/)library_600x900(?:_2x)?\.jpg(?:\?.*)?$/i;

/** Landscape art every Steam app has, tried in order when its library capsule fails. */
const STEAM_LANDSCAPE_ART = ['header.jpg', 'capsule_616x353.jpg'];

/**
 * Images to try after a Steam library capsule fails to load (some apps have none, or a CDN edge
 * misses it): the same app's store header, then its main capsule, on the same host. They are
 * landscape, so the cover letterboxes them. Empty when `url` is not a Steam library capsule.
 */
export function steamCoverFallbacks(url: string): string[] {
  const match = STEAM_LIBRARY_CAPSULE.exec(url);
  return match ? STEAM_LANDSCAPE_ART.map((file) => `${match[1]}${file}`) : [];
}

/** The first fallback (the store header), or null when `url` is not a Steam library capsule. */
export function steamHeaderFallback(url: string): string | null {
  return steamCoverFallbacks(url)[0] ?? null;
}

/**
 * The image to show after `failed` did not load: the next one in the url's fallback chain, else null.
 * `sized` (the url resized for the box, see `sizedCoverUrl`) is tried first, then the original url.
 */
export function nextCoverSource(
  url: string | null | undefined,
  failed: string,
  sized: string | null = null,
): string | null {
  if (!url) return null;
  const chain = [...(sized && sized !== url ? [sized] : []), url, ...steamCoverFallbacks(url)];
  const index = chain.indexOf(failed);
  return index >= 0 ? (chain[index + 1] ?? null) : null;
}

/** Aspect (width / height) of the cover box: IGDB's `t_cover_big` (264x374). */
export const COVER_BOX_RATIO = 264 / 374;

/**
 * Widest aspect (width / height) still cropped to fill the cover box: 20% wider than the box (~0.85),
 * so at most a sixth of the width is cut. Any reasonably portrait image (Steam's 600x900, IGDB's
 * 264x374, 3:4, slightly-off custom covers, tall art) is cropped, anchored to the top so a title
 * there survives; only clearly non-portrait art (square, landscape) is letterboxed over a blurred
 * copy of itself.
 */
export const MAX_PORTRAIT_RATIO = COVER_BOX_RATIO * 1.2;

/** Whether an image of the given size is portrait enough to be cropped (object-cover). */
export function fitsPortraitBox(width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) {
    return true;
  }
  return width / height <= MAX_PORTRAIT_RATIO;
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
 * Game cover as portrait box art (IGDB cover ratio, ~0.706). Lazy-loaded, no referrer. A Steam library capsule that fails
 * to load falls back to the app's store header, then its main capsule; clearly non-portrait art (those, a square or a custom url) is
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
        <!-- Art far from the box ratio: a blurred copy fills the poster, the whole image sits on top. -->
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
        [attr.loading]="priority() ? 'eager' : 'lazy'"
        [attr.fetchpriority]="priority() ? 'high' : null"
        [src]="current"
        [alt]="decorative() ? '' : name()"
        decoding="async"
        referrerpolicy="no-referrer"
        class="relative size-full"
        [class]="letterbox() ? 'object-contain' : 'object-cover object-top'"
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
  /** Above-the-fold hero (e.g. the game detail cover): load eagerly with high fetch priority. */
  readonly priority = input(false, { transform: booleanAttribute });
  /** Emits on each image load whether it is portrait enough to be cropped (see `fitsPortraitBox`). */
  readonly portraitChange = output<boolean>();

  /** The url resized for this box (small IGDB variant for small boxes). */
  private readonly sizedUrl = computed(() => sizedCoverUrl(this.url(), SIZE_VARIANT[this.size()]));

  /** Image being shown: the sized url, the url, its Steam fallbacks, then null (initials). Resets with the url. */
  protected readonly src = linkedSignal<string | null>(() => this.sizedUrl());

  /** The loaded image is not portrait enough to crop (see `fitsPortraitBox`); resets whenever the url changes. */
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
    const portrait = fitsPortraitBox(img.naturalWidth, img.naturalHeight);
    this.letterbox.set(!portrait);
    this.portraitChange.emit(portrait);
  }

  protected onError(failed: string): void {
    this.letterbox.set(false);
    this.src.set(nextCoverSource(this.url(), failed, this.sizedUrl()));
  }
}
