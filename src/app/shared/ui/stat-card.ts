import { ChangeDetectionStrategy, booleanAttribute, Component, input } from '@angular/core';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';

/** Label + big figure tile. `compact` is the mobile mini-stat variant (value first, no icon). */
@Component({
  selector: 'app-stat-card',
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 rounded-xl border border-border bg-surface' },
  template: `
    @if (compact()) {
      <div class="p-3">
        <p class="truncate text-xl font-semibold" [class]="valueClass()">{{ value() }}</p>
        <p class="mt-0.5 truncate text-xs text-muted">{{ label() }}</p>
      </div>
    } @else {
      <div class="px-[18px] py-4">
        <p class="flex items-center gap-2 text-[13px] text-muted">
          @if (icon(); as i) {
            <svg [lucideIcon]="i" [size]="15" class="shrink-0 text-brand-light"></svg>
          }
          <span class="truncate">{{ label() }}</span>
        </p>
        <p
          class="mt-3 truncate text-[26px] font-semibold tracking-[-0.02em] lg:text-[28px]"
          [class]="valueClass()"
        >
          {{ value() }}
        </p>
      </div>
    }
  `,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input<LucideIconInput | null>(null);
  /** Extra classes for the figure, e.g. `font-mono text-gold` for ratings. */
  readonly valueClass = input('');
  readonly compact = input(false, { transform: booleanAttribute });
}
