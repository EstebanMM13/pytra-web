import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The dashboard greeting's eyebrow: a small mono uppercase line led by a gold dot (the period a
 * stats screen covers). Text is projected.
 */
@Component({
  selector: 'app-stats-eyebrow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-muted uppercase md:text-[11px] md:tracking-[0.16em]',
  },
  template: `<span class="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true"></span><ng-content />`,
})
export class StatsEyebrow {}
