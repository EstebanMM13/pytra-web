import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export interface SegmentedOption<T extends string = string> {
  value: T;
  /** Translation key (plain text also renders as-is). */
  label: string;
}

/**
 * Segmented control. `tone="neutral"` is the quieter variant (library toolbar,
 * small card headers); the default highlights the active option in brand tint.
 */
@Component({
  selector: 'app-segmented',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'radiogroup',
    '[class]': 'hostClass()',
  },
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="option.value === value()"
        (click)="value.set(option.value)"
        [class]="optionClass(option.value === value())"
      >
        {{ option.label | translate }}
      </button>
    }
  `,
})
export class Segmented<T extends string = string> {
  readonly options = input.required<readonly SegmentedOption<T>[]>();
  readonly value = model.required<T>();
  readonly tone = input<'brand' | 'neutral'>('brand');
  readonly size = input<'sm' | 'md'>('md');
  /** Fill the available width with equal-width options (forms). */
  readonly stretch = input(false, { transform: booleanAttribute });

  // Class bindings are built as plain strings: Angular's array form treats each
  // entry as a single class name, so entries containing spaces break styling.
  protected readonly hostClass = computed(() =>
    [
      'shrink-0 border border-border bg-bg',
      this.size() === 'sm' ? 'rounded-[7px] p-0.5' : 'rounded-lg p-[3px]',
      this.stretch() ? 'flex w-full' : 'inline-flex',
    ].join(' '),
  );

  protected optionClass(active: boolean): string {
    return [
      'font-medium whitespace-nowrap',
      this.stretch() ? 'min-w-0 flex-1 truncate' : '',
      this.size() === 'sm' ? 'rounded-[5px] px-2 py-[3px] text-xs' : 'rounded-md px-3 py-1.5 text-[13px]',
      active
        ? this.tone() === 'neutral'
          ? 'bg-border text-text'
          : 'bg-brand-tint text-brand-lighter'
        : 'text-muted hover:text-text-2',
    ].join(' ');
  }
}
