import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { formatHoursInput, parseDecimal } from '../utils/decimal-input';

const WHOLE_NUMBER = /^\d+$/;

/** Decimal hours split into the texts of the "h" and "min" fields: 0.77 -> "0" h "46" min. */
export function splitHours(value: number | null): { hours: string; minutes: string } {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return { hours: '', minutes: '' };
  }
  const totalMinutes = Math.round(value * 60);
  return { hours: String(Math.floor(totalMinutes / 60)), minutes: String(totalMinutes % 60) };
}

/**
 * Decimal hours typed as hours and minutes: h + min/60 rounded to two decimals (the API keeps
 * decimal hours). Both empty is `null`; negative hours, minutes outside 0-59 or non-numbers are `NaN`.
 * The hours field also accepts a decimal ("1,5"), so pasting the old format still works.
 */
export function joinHours(hoursText: string, minutesText: string): number | null {
  const hoursRaw = hoursText.trim();
  const minutesRaw = minutesText.trim();
  if (!hoursRaw && !minutesRaw) {
    return null;
  }
  const hours = hoursRaw ? parseDecimal(hoursRaw) : 0;
  if (hours === null || Number.isNaN(hours) || hours < 0) {
    return Number.NaN;
  }
  if (minutesRaw && !WHOLE_NUMBER.test(minutesRaw)) {
    return Number.NaN;
  }
  const minutes = minutesRaw ? Number(minutesRaw) : 0;
  if (minutes > 59) {
    return Number.NaN;
  }
  return Math.round((hours + minutes / 60) * 100) / 100;
}

/**
 * Hours entry as two fields, "h" and "min". Its value is the same decimal text the hours inputs
 * always used ("12,5", "" when empty), so existing parsing and validators keep working: it works as
 * a form control (`formControlName`) or with `[(value)]`. Invalid minutes write an unparsable text
 * ("1 h 75 min") so the owner's validation rejects it instead of saving something else.
 */
@Component({
  selector: 'app-hours-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HoursInput), multi: true },
  ],
  host: { class: 'flex min-w-0 items-center gap-1.5' },
  template: `
    <input
      type="text"
      inputmode="decimal"
      autocomplete="off"
      [attr.id]="inputId()"
      [class]="fieldClass()"
      [placeholder]="placeholder()"
      [value]="hours()"
      [disabled]="isDisabled()"
      [attr.aria-label]="label() + ' (h)'"
      [attr.aria-invalid]="invalid() || null"
      [attr.aria-describedby]="describedBy()"
      (input)="onHours($any($event.target).value)"
      (blur)="onTouched()"
    />
    <span class="shrink-0 text-faint" aria-hidden="true">h</span>
    <input
      type="text"
      inputmode="numeric"
      autocomplete="off"
      [attr.id]="inputId() ? inputId() + '-min' : null"
      [class]="fieldClass()"
      [placeholder]="placeholder()"
      [value]="minutes()"
      [disabled]="isDisabled()"
      [attr.aria-label]="label() + ' (min)'"
      [attr.aria-invalid]="invalid() || null"
      [attr.aria-describedby]="describedBy()"
      (input)="onMinutes($any($event.target).value)"
      (blur)="onTouched()"
    />
    <span class="shrink-0 text-faint" aria-hidden="true">min</span>
  `,
})
export class HoursInput implements ControlValueAccessor {
  private readonly translate = inject(TranslateService);

  /** Decimal hours text ("12,5"; "" when empty). */
  readonly value = model('');
  /** Id of the hours field (the minutes field gets `<id>-min`), so a label or focus can target it. */
  readonly inputId = input<string | null>(null);
  /** Accessible name; each field adds its unit ("Hours (h)", "Hours (min)"). */
  readonly label = input('');
  readonly placeholder = input('0');
  /** Classes of each field. */
  readonly fieldClass = input('min-w-0 w-full');
  readonly invalid = input(false, { transform: booleanAttribute });
  /** Id of an error or hint that describes both fields. */
  readonly describedBy = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly hours = signal('');
  protected readonly minutes = signal('');
  private readonly formDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  /** Value the two fields currently show, so only outside changes re-split them. */
  private shown: string | null = null;
  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  constructor() {
    effect(() => {
      const value = this.value();
      untracked(() => this.show(value));
    });
  }

  writeValue(value: unknown): void {
    const text =
      typeof value === 'number' ? formatHoursInput(value, this.lang()) : String(value ?? '');
    this.value.set(text);
    this.show(text);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
  }

  protected onHours(text: string): void {
    this.hours.set(text);
    this.emit();
  }

  protected onMinutes(text: string): void {
    this.minutes.set(text);
    this.emit();
  }

  private emit(): void {
    const joined = joinHours(this.hours(), this.minutes());
    const text =
      joined === null
        ? ''
        : Number.isNaN(joined)
          ? `${this.hours().trim()} h ${this.minutes().trim()} min`
          : formatHoursInput(joined, this.lang());
    this.shown = text;
    this.value.set(text);
    this.onChange(text);
  }

  private show(text: string): void {
    if (text === this.shown) {
      return;
    }
    this.shown = text;
    const value = parseDecimal(text);
    if (value !== null && Number.isNaN(value)) {
      return; // Unparsable text keeps whatever is typed.
    }
    const { hours, minutes } = splitHours(value);
    this.hours.set(hours);
    this.minutes.set(minutes);
  }

  private lang(): string {
    return this.translate.currentLang() ?? 'es';
  }
}
