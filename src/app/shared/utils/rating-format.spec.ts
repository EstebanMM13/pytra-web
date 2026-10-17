import { formatRating, ratingDecimals, ratingLocale } from './rating-format';

describe('ratingDecimals', () => {
  it('maps each precision to its fixed decimals', () => {
    expect(ratingDecimals('integer')).toBe(0);
    expect(ratingDecimals('half')).toBe(1);
    expect(ratingDecimals('hundredths')).toBe(2);
  });
});

describe('ratingLocale', () => {
  it('maps the UI language to its display locale (Spanish by default)', () => {
    expect(ratingLocale('en')).toBe('en-US');
    expect(ratingLocale('es')).toBe('es-ES');
    expect(ratingLocale(undefined)).toBe('es-ES');
  });
});

describe('formatRating', () => {
  it("uses the locale's decimal separator, Spanish (comma) by default", () => {
    expect(formatRating(9.75, 2)).toBe('9,75');
    expect(formatRating(9.75, 2, 'es-ES')).toBe('9,75');
    expect(formatRating(9.75, 2, 'en-US')).toBe('9.75');
    expect(formatRating(9.25, 1, 'es-ES')).toBe('9,3');
    expect(formatRating(10, 2, 'es-ES')).toBe('10,00');
    expect(formatRating(9.5, 0, 'es-ES')).toBe('10');
    expect(formatRating(null, 2, 'en-US')).toBe('—');
  });

  it('always shows two decimals in hundredths mode', () => {
    expect(formatRating(9.5, 2, 'en-US')).toBe('9.50');
    expect(formatRating(9, 2, 'en-US')).toBe('9.00');
    expect(formatRating(9.25, 2, 'en-US')).toBe('9.25');
    expect(formatRating(8.083333, 2, 'en-US')).toBe('8.08');
    expect(formatRating(10, 2, 'en-US')).toBe('10.00');
  });

  it('always shows one decimal in half mode, rounding half up', () => {
    expect(formatRating(9.25, 1, 'en-US')).toBe('9.3');
    expect(formatRating(9, 1, 'en-US')).toBe('9.0');
    expect(formatRating(9.24, 1, 'en-US')).toBe('9.2');
    expect(formatRating(10, 1, 'en-US')).toBe('10.0');
  });

  it('rounds to an integer in integer mode', () => {
    expect(formatRating(9.5, 0, 'en-US')).toBe('10');
    expect(formatRating(9.49, 0, 'en-US')).toBe('9');
    expect(formatRating(10, 0, 'en-US')).toBe('10');
    expect(formatRating(0, 0, 'en-US')).toBe('0');
  });

  it('rounds half up despite binary drift', () => {
    expect(formatRating(9.995, 2, 'en-US')).toBe('10.00');
    expect(formatRating(9.995, 1, 'en-US')).toBe('10.0');
    expect(formatRating(9.995, 0, 'en-US')).toBe('10');
    expect(formatRating(8.125, 2, 'en-US')).toBe('8.13');
  });

  it('renders missing values as an em dash', () => {
    expect(formatRating(null, 2)).toBe('—');
    expect(formatRating(undefined, 1)).toBe('—');
    expect(formatRating(Number.NaN, 0)).toBe('—');
  });
});
