import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Gold uppercase section label followed by a fading rule; projects an optional right slot. */
@Component({
  selector: 'app-section-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-3' },
  template: `
    <h2 class="shrink-0 text-xs font-semibold tracking-[0.08em] text-gold uppercase md:text-[13px]">
      {{ label() }}
    </h2>
    <span class="h-px flex-1 bg-linear-to-r from-gold-line to-transparent" aria-hidden="true"></span>
    <ng-content />
  `,
})
export class SectionHeader {
  readonly label = input.required<string>();
}
