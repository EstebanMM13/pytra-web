import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The dashboard's mono pill with a gold ring (day counts, small totals). Text is projected. */
@Component({
  selector: 'app-stats-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'inline-block shrink-0 rounded-full bg-hover px-2.5 py-1 font-mono text-[11px] text-text-3 ring-1 ring-gold/70 ring-inset md:text-xs',
  },
  template: `<ng-content />`,
})
export class StatsPill {}
