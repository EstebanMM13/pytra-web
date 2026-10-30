import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { COVER_BOX_PX, FixedCoverSize, GameCover } from '../../shared/ui/game-cover';
import { CoverRef } from './stats.logic';

/** Most covers a stack shows (the sagas list collage shows four too). */
export const MAX_STACK_COVERS = 4;

/** Horizontal step between stacked covers, per cover size (px). */
const STEP: Record<FixedCoverSize, number> = { xs: 11, sm: 14, md: 22 };

/**
 * Up to four covers as an overlapping, slightly fanned stack of box art (the sagas list look):
 * each next cover a step to the right and behind, tilted a few degrees. With `compactSize`, the
 * stack is drawn at that smaller size below `compactBelow` (a CSS zoom, so one set of covers
 * serves both widths). `pending` keeps the room of a full stack while the covers load, so the
 * layout does not shift when they arrive. Decorative: the caller names the games in text.
 */
@Component({
  selector: 'app-stats-cover-stack',
  imports: [GameCover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block shrink-0',
    'aria-hidden': 'true',
    '[style.width.px]': 'width()',
    '[style.height.px]': 'height()',
    '[style.--compact-zoom]': 'compactZoom()',
    '[attr.data-compact]': 'compactSize() ? compactBelow() : null',
  },
  styles: `
    @media (width < 380px) {
      :host([data-compact='narrow']) {
        zoom: var(--compact-zoom);
      }
    }
    @media (width < 48rem) {
      :host([data-compact='md']) {
        zoom: var(--compact-zoom);
      }
    }
  `,
  template: `
    @for (cover of shown(); track cover.id; let i = $index) {
      <!-- The wrapper is positioned: GameCover owns its host classes and would drop \`absolute\`. -->
      <span
        class="absolute top-0 block rounded-[4px] shadow-md ring-2 shadow-black/30 ring-bg"
        [style.left.px]="i * step()"
        [style.z-index]="shown().length - i"
        [style.rotate]="(i - 1) * 3 + 'deg'"
      >
        <app-game-cover decorative [size]="size()" [url]="cover.url" [name]="cover.name" />
      </span>
    }
  `,
})
export class StatsCoverStack {
  readonly covers = input.required<readonly CoverRef[]>();
  readonly size = input<FixedCoverSize>('sm');
  /** Smaller size used below `compactBelow` (null: always `size`). */
  readonly compactSize = input<FixedCoverSize | null>(null);
  /** Where the compact size applies: under 380px wide ('narrow') or under the md breakpoint. */
  readonly compactBelow = input<'narrow' | 'md'>('narrow');
  /** Covers still loading: keep the room of a full stack. */
  readonly pending = input(false);

  protected readonly shown = computed(() => this.covers().slice(0, MAX_STACK_COVERS));
  protected readonly step = computed(() => STEP[this.size()]);
  /** Covers the box is sized for: the shown ones, or a full stack while pending. */
  private readonly slots = computed(() => (this.pending() && !this.shown().length ? MAX_STACK_COVERS : this.shown().length));
  protected readonly width = computed(() =>
    this.slots() ? COVER_BOX_PX[this.size()].width + (this.slots() - 1) * this.step() : 0,
  );
  protected readonly height = computed(() => (this.slots() ? COVER_BOX_PX[this.size()].height : 0));
  protected readonly compactZoom = computed(() => {
    const compact = this.compactSize();
    return compact ? COVER_BOX_PX[compact].height / COVER_BOX_PX[this.size()].height : null;
  });
}
