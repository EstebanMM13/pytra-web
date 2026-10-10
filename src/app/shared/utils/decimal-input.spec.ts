import { FormControl } from '@angular/forms';
import { decimalValidator, formatDecimalInput, parseDecimal } from './decimal-input';

describe('parseDecimal', () => {
  it('accepts comma and dot separators', () => {
    expect(parseDecimal('9,25')).toBe(9.25);
    expect(parseDecimal('9.5')).toBe(9.5);
    expect(parseDecimal(' 7 ')).toBe(7);
    expect(parseDecimal(',5')).toBe(0.5);
    expect(parseDecimal(8.75)).toBe(8.75);
  });

  it('returns null for empty input', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
  });

  it('returns NaN for garbage', () => {
    for (const text of ['abc', '9,2,5', '1.000,5', '9 5', '1e3', '--1']) {
      expect(parseDecimal(text)).toBeNaN();
    }
    expect(parseDecimal(Number.NaN)).toBeNaN();
  });
});

describe('formatDecimalInput', () => {
  it('uses a comma in Spanish and a dot in English', () => {
    expect(formatDecimalInput(9.25, 'es')).toBe('9,25');
    expect(formatDecimalInput(9.25, 'en')).toBe('9.25');
    expect(formatDecimalInput(null, 'es')).toBe('');
  });
});

describe('decimalValidator', () => {
  const validator = decimalValidator('hours', (n) => n >= 0);

  it('flags garbage and rule violations, allows empty', () => {
    expect(validator(new FormControl(''))).toBeNull();
    expect(validator(new FormControl('12,5'))).toBeNull();
    expect(validator(new FormControl('abc'))).toEqual({ hours: true });
    expect(validator(new FormControl('-1'))).toEqual({ hours: true });
  });
});
