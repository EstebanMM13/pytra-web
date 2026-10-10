import { ratingTone } from './rating-tone';

describe('ratingTone', () => {
  it('marks 9 and above as high', () => {
    expect(ratingTone(9)).toBe('text-rating-high');
    expect(ratingTone(9.75)).toBe('text-rating-high');
    expect(ratingTone(10)).toBe('text-rating-high');
  });

  it('keeps 7 to below 9 gold', () => {
    expect(ratingTone(7)).toBe('text-gold');
    expect(ratingTone(8.99)).toBe('text-gold');
  });

  it('uses the muted amber for 6 to below 7', () => {
    expect(ratingTone(6)).toBe('text-rating-mid');
    expect(ratingTone(6.99)).toBe('text-rating-mid');
  });

  it('flags below 6 as danger', () => {
    expect(ratingTone(5.99)).toBe('text-danger');
    expect(ratingTone(0)).toBe('text-danger');
  });

  it('falls back to gold for missing ratings', () => {
    expect(ratingTone(null)).toBe('text-gold');
    expect(ratingTone(undefined)).toBe('text-gold');
    expect(ratingTone(Number.NaN)).toBe('text-gold');
  });
});
