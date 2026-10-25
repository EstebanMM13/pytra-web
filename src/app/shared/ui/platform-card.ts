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
  // Component CSS rather than template utilities: these rules ship with the lazy Sync chunk.
  styles: `
    /* Phones: the badge drops under the title so the subtitle keeps the row's width. */
    .platform-header {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 0.5rem 0.75rem;
    }
    .platform-badge {
      grid-column-start: 2;
      justify-self: start;
    }
    @media (width >= 40rem) {
      .platform-header {
        grid-template-columns: auto minmax(0, 1fr) auto;
      }
      .platform-badge {
        grid-column-start: 3;
        justify-self: auto;
      }
    }
  `,
  template: `
    <section
      class="rounded-[14px] border border-card-border card-glass"
      [class.opacity-70]="disabled()"
      [attr.data-platform]="platform()"
      [attr.aria-labelledby]="titleId"
      [attr.aria-disabled]="disabled() ? 'true' : null"
    >
      <header class="platform-header p-4 md:p-[22px]">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl"
          [class]="disabled() ? 'bg-hover text-muted' : 'bg-hover text-text'"
          aria-hidden="true"
        >
          <ng-content select="[platformIcon]" />
        </span>
        <div class="min-w-0">
          <h2 [id]="titleId" class="text-lg font-semibold tracking-[-0.01em]">{{ name() }}</h2>
          <p class="text-[13px] text-muted">{{ subtitle() }}</p>
        </div>
        <div class="platform-badge empty:hidden"><ng-content select="[platformBadge]" /></div>
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
