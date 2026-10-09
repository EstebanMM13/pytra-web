import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Loading placeholder: size and radius come from host classes, e.g. `class="h-24 rounded-xl"`. */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block animate-pulse border border-border bg-surface', 'aria-hidden': 'true' },
  template: '',
})
export class Skeleton {}
