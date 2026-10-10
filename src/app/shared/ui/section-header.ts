import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal } from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { CollapseStateService } from '../../core/services/collapse-state.service';

let nextRegionId = 0;

/**
 * Gold uppercase section label followed by a fading rule; projects an optional right slot.
 *
 * With `collapseKey` set it also renders a chevron toggle that collapses its parent card:
 * the parent gets `data-collapsed` and global CSS hides every sibling after the header
 * (see `styles.css`), so card templates need no extra wrapper. State persists per key.
 */
@Component({
  selector: 'app-section-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideChevronDown, TranslatePipe],
  host: { class: 'flex items-center gap-3' },
  template: `
    <h2 class="shrink-0 text-xs font-semibold tracking-[0.08em] text-gold uppercase md:text-[13px]">
      {{ label() }}
    </h2>
    <span class="h-px flex-1 bg-linear-to-r from-gold-line to-transparent" aria-hidden="true"></span>
    <ng-content />
    @if (collapseKey()) {
      <button
        type="button"
        (click)="toggle()"
        class="-my-3 -mr-2.5 grid size-11 shrink-0 place-items-center rounded-lg text-faint hover:bg-hover hover:text-text md:-my-1.5 md:-mr-1.5 md:size-8"
        [attr.aria-expanded]="!collapsed()"
        [attr.aria-controls]="regionId()"
        [attr.aria-label]="(collapsed() ? 'common.expandSection' : 'common.collapseSection') | translate: { name: label() }"
      >
        <svg
          lucideChevronDown
          [size]="18"
          class="transition-transform duration-200 motion-reduce:transition-none"
          [class.-rotate-90]="collapsed()"
          aria-hidden="true"
        ></svg>
      </button>
    }
  `,
})
export class SectionHeader {
  readonly label = input.required<string>();
  /** Stable "screen.card" key; enables the collapse toggle when set. */
  readonly collapseKey = input<string>();

  private readonly store = inject(CollapseStateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly collapsed = computed(() => {
    const key = this.collapseKey();
    return key ? this.store.collapsed(key)() : false;
  });
  protected readonly regionId = signal('');

  constructor() {
    effect(() => {
      const card = this.host.parentElement;
      if (!card || !this.collapseKey()) return;
      if (!card.id) card.id = `pt-collapsible-${++nextRegionId}`;
      this.regionId.set(card.id);
      card.setAttribute('data-collapsible', '');
      card.setAttribute('data-collapsed', String(this.collapsed()));
    });
  }

  protected toggle(): void {
    const key = this.collapseKey();
    if (!key) return;
    const card = this.host.parentElement;
    card?.removeAttribute('data-expanding');
    this.store.toggle(key);
    if (card && !this.store.collapsed(key)()) {
      // Replays the reveal animation only on user-triggered expands (not on page load).
      void card.offsetWidth;
      card.setAttribute('data-expanding', '');
      setTimeout(() => card.removeAttribute('data-expanding'), 300);
    }
  }
}
