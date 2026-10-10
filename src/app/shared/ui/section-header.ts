import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal } from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { CollapseBreakpoint, CollapseStateService } from '../../core/services/collapse-state.service';

let nextRegionId = 0;

/**
 * Gold uppercase section label followed by a fading rule; projects an optional right slot.
 *
 * With `collapseKey` set it also renders a chevron toggle that collapses its parent card:
 * the parent gets `data-collapsed` and global CSS hides every sibling after the header
 * (see `styles.css`), so card templates need no extra wrapper. State persists per key.
 *
 * Cards sharing a desktop grid row also set the same `collapseGroup`: from the
 * `collapseGroupFrom` breakpoint up they share one row state (toggling any collapses the
 * whole row, so the row height really shrinks); below it each card collapses on its own.
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
  /** Stable "screen.row" key shared by the cards of one multi-column grid row. */
  readonly collapseGroup = input<string>();
  /** Breakpoint from which the row lays its cards side by side (and shares state). */
  readonly collapseGroupFrom = input<CollapseBreakpoint>('md');

  private readonly store = inject(CollapseStateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private readonly rowMode = computed(
    () => !!this.collapseGroup() && this.store.atLeast(this.collapseGroupFrom())(),
  );
  protected readonly collapsed = computed(() => {
    const key = this.collapseKey();
    if (!key) return false;
    const group = this.collapseGroup();
    return this.rowMode() && group ? this.store.rowCollapsed(group)() : this.store.collapsed(key)();
  });
  protected readonly regionId = signal('');

  constructor() {
    let previous: boolean | undefined;
    effect(() => {
      const card = this.host.parentElement;
      const collapsed = this.collapsed();
      if (!card || !this.collapseKey()) return;
      if (!card.id) card.id = `pt-collapsible-${++nextRegionId}`;
      this.regionId.set(card.id);
      card.setAttribute('data-collapsible', '');
      card.setAttribute('data-collapsed', String(collapsed));
      // Replays the reveal animation on expands after the first render (never on page load),
      // so every card of a row animates when the row is expanded from any of them.
      if (previous === true && !collapsed) {
        card.removeAttribute('data-expanding');
        void card.offsetWidth;
        card.setAttribute('data-expanding', '');
        setTimeout(() => card.removeAttribute('data-expanding'), 300);
      }
      previous = collapsed;
    });
  }

  protected toggle(): void {
    const key = this.collapseKey();
    const group = this.collapseGroup();
    if (!key) return;
    if (this.rowMode() && group) this.store.toggleRow(group);
    else this.store.toggle(key);
  }
}
