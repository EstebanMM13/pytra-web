import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const DECIMAL_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/**
 * Parses a typed decimal accepting both "," and "." as separator ("9,25" and "9.25").
 * Empty input is `null` (optional field); anything that is not a plain number is `NaN`, so a
 * validator can reject it instead of silently saving nothing. Numbers pass through.
 */
export function parseDecimal(input: unknown): number | null {
  if (input === null || input === undefined) {
    return null;
  }
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : Number.NaN;
  }
  const text = String(input).trim();
  if (!text) {
    return null;
  }
  const normalized = text.replace(',', '.');
  return DECIMAL_PATTERN.test(normalized) ? Number(normalized) : Number.NaN;
}

/** Text for a decimal input: "" for null, comma separator in Spanish ("9,25"). */
export function formatDecimalInput(value: number | null | undefined, lang: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '';
  }
  const text = String(value);
  return lang === 'en' ? text : text.replace('.', ',');
}

/**
 * Text for an hours input: rounded to at most two decimals with trailing zeros trimmed, so imported
 * minute counts read "0,32" instead of "0,316666666666". Two decimals is what the hours fields accept.
 */
export function formatHoursInput(value: number | null | undefined, lang: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '';
  }
  return formatDecimalInput(Math.round(value * 100) / 100, lang);
}

/**
 * Validator for a text decimal input: empty is valid (combine with `required` if needed),
 * unparsable text and values rejected by `isValid` produce `{ [errorKey]: true }`.
 */
export function decimalValidator(errorKey: string, isValid: (value: number) => boolean): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = parseDecimal(control.value);
    if (value === null) {
      return null;
    }
    return Number.isNaN(value) || !isValid(value) ? { [errorKey]: true } : null;
  };
}
