import { ChangeDetectionStrategy, booleanAttribute, Component, input } from '@angular/core';

let nextTitleId = 0;

/**
 * One platform on the Sync page: header (a logo projected with `[platformIcon]`, name, subtitle and
 * a status badge projected with `[platformBadge]`) and a body below it (default slot; hidden when nothing is projected).
 * `disabled` dims the card and marks it `aria-disabled` (announced, not available yet).
 */
@Component({
  selector: 'app-platform-card',
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
      <!-- Phones: the badge drops under the title so the subtitle keeps the row's width. -->
      <header
        class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-3 md:p-[22px]"
      >
        <span
          class="row-span-2 flex size-10 shrink-0 items-center justify-center self-start rounded-xl sm:row-span-1 sm:self-center"
          [class]="disabled() ? 'bg-hover text-muted' : 'bg-hover text-text'"
          aria-hidden="true"
        >
          <ng-content select="[platformIcon]" />
        </span>
        <div class="min-w-0">
          <h2 [id]="titleId" class="text-lg font-semibold tracking-[-0.01em]">{{ name() }}</h2>
          <p class="text-[13px] text-muted">{{ subtitle() }}</p>
        </div>
        <div class="col-start-2 justify-self-start empty:hidden sm:col-start-3 sm:justify-self-auto"><ng-content select="[platformBadge]" /></div>
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
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly titleId = `pt-platform-title-${++nextTitleId}`;
}
