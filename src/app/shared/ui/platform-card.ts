import { ChangeDetectionStrategy, booleanAttribute, Component, input } from '@angular/core';
import { LucideDynamicIcon, LucideIconData } from '@lucide/angular';

let nextTitleId = 0;

/**
 * One platform on the Sync page: header (icon, name, subtitle and a status badge projected with
 * `[platformBadge]`) and a body below it (default slot; hidden when nothing is projected).
 * `disabled` dims the card and marks it `aria-disabled` (announced, not available yet).
 */
@Component({
  selector: 'app-platform-card',
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section
      class="rounded-[14px] border border-card-border card-glass"
      [class.opacity-70]="disabled()"
      [attr.data-platform]="platform()"
      [attr.aria-labelledby]="titleId"
      [attr.aria-disabled]="disabled() ? 'true' : null"
    >
      <header class="flex items-center gap-3 p-4 md:p-[22px]">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl"
          [class]="disabled() ? 'bg-hover text-muted' : 'bg-brand-tint text-brand-lighter'"
          aria-hidden="true"
        >
          <svg [lucideIcon]="icon()" [size]="20"></svg>
        </span>
        <div class="min-w-0 flex-1">
          <h2 [id]="titleId" class="text-lg font-semibold tracking-[-0.01em]">{{ name() }}</h2>
          <p class="text-[13px] text-muted">{{ subtitle() }}</p>
        </div>
        <div class="shrink-0 empty:hidden"><ng-content select="[platformBadge]" /></div>
      </header>
      <div class="border-t border-divider p-4 empty:hidden md:p-[22px]"><ng-content /></div>
    </section>
  `,
})
export class PlatformCard {
  /** Stable platform key, exposed as `data-platform` (e.g. "steam", "playstation"). */
  readonly platform = input.required<string>();
  readonly name = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly icon = input.required<LucideIconData>();
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly titleId = `pt-platform-title-${++nextTitleId}`;
}
