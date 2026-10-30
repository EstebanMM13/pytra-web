import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { sizedCoverUrl } from '../../shared/ui/game-cover';
import { PytraMark } from '../../shared/ui/pytra-mark';

/** Corner radius of the stats heroes (the dashboard greeting's); their loading skeletons share it. */
export const STATS_HERO_RADIUS = 'rounded-[18px]';

/** Per tone: the frame classes, the corner glow colour and the watermark colour. */
const TONES = {
  brand: {
    frame: 'border border-card-border',
    glow: 'color-mix(in srgb, var(--pt-brand) 12%, transparent)',
    watermark: 'text-brand-light',
  },
  gold: {
    frame: 'gold-border',
    glow: 'color-mix(in srgb, var(--pt-gold) 12%, transparent)',
    watermark: 'text-gold',
  },
} as const;

/**
 * The focal card of a stats screen, set apart from the regular glass cards the way the dashboard
 * greeting and the year hero are: the dashboard's corner brand glow and a large faint watermark
 * (a section icon, or the Pytra mark without one), or a game's blurred cover as the backdrop
 * (a broken image falls back to the glow). `gold` draws the GOTY card's gold border and fill
 * instead (ratings). Content is projected.
 */
@Component({
  selector: 'app-stats-hero',
  imports: [LucideDynamicIcon, PytraMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative isolate block overflow-hidden ' + STATS_HERO_RADIUS,
    '[class]': 'look().frame',
    'data-stats-hero': '',
  },
  template: `
    <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      @if (backdropUrl(); as url) {
        <!-- A blurred backdrop needs no detail: the small cover variant. -->
        <img
          [src]="url"
          alt=""
          decoding="async"
          referrerpolicy="no-referrer"
          class="size-full scale-110 object-cover opacity-50 blur-2xl saturate-150 light:opacity-70 light:brightness-125 light:saturate-200"
          (error)="backdropFailed.set(true)"
        />
        <div class="absolute inset-0 bg-linear-to-r from-bg/40 via-bg/60 to-bg/85 light:from-bg/30 light:via-bg/50 light:to-bg/75"></div>
      } @else {
        <div
          class="absolute inset-0 bg-[radial-gradient(360px_260px_at_0%_0%,var(--hero-glow),transparent_70%)] md:bg-[radial-gradient(620px_340px_at_0%_0%,var(--hero-glow),transparent_70%)] light:opacity-70"
          [style.--hero-glow]="look().glow"
        ></div>
      }
      @if (watermark(); as icon) {
        <span
          class="absolute -top-8 -right-10 rotate-[-12deg] opacity-[0.07] md:-top-12 md:-right-12 light:opacity-[0.12]"
          [class]="look().watermark"
        >
          <svg [lucideIcon]="icon" [size]="170" [strokeWidth]="1.5"></svg>
        </span>
      } @else if (!backdropUrl()) {
        <app-pytra-mark class="absolute -top-10 -right-14 size-[180px] rotate-[-12deg] opacity-[0.06] md:-top-20 md:-right-16 md:size-[280px] light:opacity-[0.12]" />
      }
    </div>
    <ng-content />
  `,
})
export class StatsHero {
  /** Large faint icon in the top-right corner; the Pytra mark when null (and no backdrop). */
  readonly watermark = input<LucideIconInput | null>(null);
  /** A cover url blurred behind the content (replaces the glow and the mark). */
  readonly backdrop = input<string | null>(null);
  readonly tone = input<keyof typeof TONES>('brand');

  protected readonly look = computed(() => TONES[this.tone()]);
  /** The backdrop failed to load: show the glow instead (reset when the url changes). */
  protected readonly backdropFailed = linkedSignal({ source: this.backdrop, computation: () => false });
  protected readonly backdropUrl = computed(() =>
    this.backdropFailed() ? null : sizedCoverUrl(this.backdrop(), 'small'),
  );
}
