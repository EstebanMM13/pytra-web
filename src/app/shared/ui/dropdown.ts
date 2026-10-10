import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { LucideCheck, LucideChevronDown } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

export interface DropdownOption<T extends string = string> {
  value: T;
  /** Translation key (plain text also renders as-is). */
  label: string;
}

/**
 * Themed single-select dropdown (button + listbox) used instead of native <select>,
 * whose popup can't be styled. Keyboard: arrows move, Enter/Space pick, Escape closes.
 */
@Component({
  selector: 'app-dropdown',
  imports: [LucideCheck, LucideChevronDown, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative inline-block',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <button
      type="button"
      class="flex items-center gap-2 rounded-lg border px-3 py-[9px] text-[13px] transition-colors hover:border-border-strong"
      [class]="highlighted() ? 'border-brand text-brand-lighter' : 'border-border text-text-3'"
      aria-haspopup="listbox"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="ariaLabel()"
      (click)="toggle()"
    >
      <ng-content />
      @if (prefix()) {
        <span class="text-muted">{{ prefix() }}</span>
      }
      <span class="font-medium" [class]="highlighted() ? 'text-brand-lighter' : 'text-text-2'">{{ selectedLabel() | translate }}</span>
      <svg lucideChevronDown [size]="14" class="shrink-0 transition-transform" [class.rotate-180]="open()"></svg>
    </button>

    @if (open()) {
      <ul
        role="listbox"
        [attr.aria-label]="ariaLabel()"
        class="scroll-thin absolute top-full z-40 mt-1.5 max-h-72 min-w-full overflow-y-auto rounded-[10px] border border-border bg-surface p-1 shadow-[0_12px_32px_#0006]"
        [class]="align() === 'end' ? 'right-0' : 'left-0'"
      >
        @for (option of options(); track option.value; let i = $index) {
          <li
            role="option"
            [attr.aria-selected]="option.value === value()"
            class="flex cursor-pointer items-center justify-between gap-6 rounded-md px-3 py-2 text-[13px] whitespace-nowrap"
            [class]="
              option.value === value()
                ? 'bg-brand-tint text-brand-lighter'
                : i === activeIndex()
                  ? 'bg-hover text-text'
                  : 'text-text-2'
            "
            (mouseenter)="activeIndex.set(i)"
            (click)="pick(option.value)"
          >
            {{ option.label | translate }}
            @if (option.value === value()) {
              <svg lucideCheck [size]="14" class="shrink-0"></svg>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class Dropdown<T extends string = string> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input.required<readonly DropdownOption<T>[]>();
  readonly value = model.required<T>();
  /** Muted text shown before the selected label, e.g. "Plataforma:". */
  readonly prefix = input<string>('');
  readonly ariaLabel = input<string>('');
  /** Brand-coloured trigger, e.g. while a filter is active. */
  readonly highlighted = input(false);
  /** Which edge the popup aligns to. */
  readonly align = input<'start' | 'end'>('start');

  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly selectedLabel = computed(
    () => this.options().find((o) => o.value === this.value())?.label ?? '',
  );

  protected toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.open.set(true);
      this.activeIndex.set(this.options().findIndex((o) => o.value === this.value()));
    }
  }

  protected pick(value: T): void {
    this.value.set(value);
    this.close();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.options().length;
    if (!this.open()) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.toggle();
      }
      return;
    }
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        this.host.nativeElement.querySelector('button')?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update((i) => (i <= 0 ? count - 1 : i - 1));
        break;
      case 'Enter':
      case ' ': {
        const option = this.options()[this.activeIndex()];
        if (option) {
          event.preventDefault();
          this.pick(option.value);
        }
        break;
      }
      case 'Tab':
        this.close();
        break;
    }
  }

  private close(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
  }
}
