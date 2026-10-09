import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

export type PageSlot = number | 'gap';

/**
 * Page numbers to render: always the first and last page, the current one and its neighbours,
 * with `gap` where pages are skipped. 1 2 3 … 8 / 1 … 4 5 6 … 8 / 1 … 6 7 8.
 */
export function pageSlots(current: number, total: number): PageSlot[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) {
    [2, 3, 4].forEach((p) => pages.add(p));
  }
  if (current >= total - 2) {
    [total - 3, total - 2, total - 1].forEach((p) => pages.add(p));
  }
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const slots: PageSlot[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) {
      slots.push('gap');
    }
    slots.push(p);
  });
  return slots;
}

/** Compact page selector; the active page uses the brand tint. Hidden when there is a single page. */
@Component({
  selector: 'app-pagination',
  imports: [TranslatePipe, LucideChevronLeft, LucideChevronRight],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 1) {
      <nav class="flex items-center gap-1 text-[13px]" [attr.aria-label]="'pagination.label' | translate">
        <button
          type="button"
          class="rounded-md p-1 text-muted hover:text-text disabled:opacity-40"
          [disabled]="page() <= 1"
          (click)="go(page() - 1)"
          [attr.aria-label]="'pagination.previous' | translate"
        >
          <svg lucideChevronLeft [size]="16"></svg>
        </button>
        @for (slot of slots(); track $index) {
          @if (slot === 'gap') {
            <span class="px-1.5 text-faint" aria-hidden="true">…</span>
          } @else {
            <button
              type="button"
              (click)="go(slot)"
              [attr.aria-current]="slot === page() ? 'page' : null"
              class="min-w-[30px] rounded-md px-2.5 py-1 font-mono"
              [class]="slot === page() ? 'bg-brand-tint text-brand-lighter' : 'text-muted hover:text-text'"
            >
              {{ slot }}
            </button>
          }
        }
        <button
          type="button"
          class="rounded-md p-1 text-muted hover:text-text disabled:opacity-40"
          [disabled]="page() >= total()"
          (click)="go(page() + 1)"
          [attr.aria-label]="'pagination.next' | translate"
        >
          <svg lucideChevronRight [size]="16"></svg>
        </button>
      </nav>
    }
  `,
})
export class Pagination {
  /** 1-based current page. */
  readonly page = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  protected readonly slots = computed(() => pageSlots(this.page(), this.total()));

  protected go(page: number): void {
    if (page >= 1 && page <= this.total() && page !== this.page()) {
      this.pageChange.emit(page);
    }
  }
}
