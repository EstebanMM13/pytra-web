import {
  RATING_SCALES,
  RatingScale,
  formatScaledPoint,
  formatScaledRating,
  fromRatingScale,
  isValidScaledRating,
  isValidTypedRating,
  ratingInputParams,
  ratingScaleMax,
  scaledRatingDecimals,
  scaledRatingDraft,
  scaledRatingStep,
  toRatingScale,
} from './rating-scale';

describe('ratingScaleMax', () => {
  it('maps each scale to its upper bound', () => {
    expect(ratingScaleMax('10')).toBe(10);
    expect(ratingScaleMax('100')).toBe(100);
    expect(ratingScaleMax('5')).toBe(5);
  });
});

describe('toRatingScale', () => {
  it('converts a stored 0–10 rating to each scale', () => {
    expect(toRatingScale(8.7, '10')).toBe(8.7);
    expect(toRatingScale(8.7, '100')).toBe(87);
    expect(toRatingScale(8.7, '5')).toBe(4.35);
    expect(toRatingScale(8.75, '100')).toBe(87.5);
    expect(toRatingScale(8.75, '5')).toBe(4.375);
  });

  it('maps the boundaries to 0 and the scale max', () => {
    for (const scale of RATING_SCALES) {
      expect(toRatingScale(0, scale)).toBe(0);
      expect(toRatingScale(10, scale)).toBe(ratingScaleMax(scale));
    }
  });

  it('has no binary drift', () => {
    expect(toRatingScale(0.07, '100')).toBe(0.7);
    expect(toRatingScale(9.99, '100')).toBe(99.9);
    expect(toRatingScale(0.01, '5')).toBe(0.005);
  });
});

describe('fromRatingScale', () => {
  it('converts typed values back to the stored 0–10 scale', () => {
    expect(fromRatingScale(87, '100')).toBe(8.7);
    expect(fromRatingScale(87.5, '100')).toBe(8.75);
    expect(fromRatingScale(4.3, '5')).toBe(8.6);
    expect(fromRatingScale(4.25, '5')).toBe(8.5);
    expect(fromRatingScale(4.33, '5')).toBe(8.66);
    expect(fromRatingScale(9.25, '10')).toBe(9.25);
  });

  it('maps the boundaries to 0 and 10', () => {
    for (const scale of RATING_SCALES) {
      expect(fromRatingScale(0, scale)).toBe(0);
      expect(fromRatingScale(ratingScaleMax(scale), scale)).toBe(10);
    }
  });

  it('rounds half up to the two decimals the API accepts', () => {
    expect(fromRatingScale(87.55, '100')).toBe(8.76);
    expect(fromRatingScale(4.375, '5')).toBe(8.75);
    expect(fromRatingScale(4.3333, '5')).toBe(8.67);
    expect(fromRatingScale(9.255, '10')).toBe(9.26);
  });

  it('round-trips every stored hundredth on every scale', () => {
    for (const scale of RATING_SCALES) {
      for (let cents = 0; cents <= 1000; cents++) {
        const stored = cents / 100;
        expect(fromRatingScale(toRatingScale(stored, scale), scale)).toBe(stored);
      }
    }
  });
});

describe('scaledRatingDecimals / scaledRatingStep', () => {
  it('follows the precision, with one decimal at most on 0–100', () => {
    expect(scaledRatingDecimals('10', 'integer')).toBe(0);
    expect(scaledRatingDecimals('10', 'half')).toBe(1);
    expect(scaledRatingDecimals('10', 'hundredths')).toBe(2);
    expect(scaledRatingDecimals('100', 'integer')).toBe(0);
    expect(scaledRatingDecimals('100', 'half')).toBe(1);
    expect(scaledRatingDecimals('100', 'hundredths')).toBe(1);
    expect(scaledRatingDecimals('5', 'integer')).toBe(0);
    expect(scaledRatingDecimals('5', 'half')).toBe(1);
    expect(scaledRatingDecimals('5', 'hundredths')).toBe(2);
  });

  it('types in steps of 1 / 0.5 / the finest step that still stores at two decimals', () => {
    expect(scaledRatingStep('10', 'integer')).toBe(1);
    expect(scaledRatingStep('10', 'half')).toBe(0.5);
    expect(scaledRatingStep('10', 'hundredths')).toBe(0.01);
    expect(scaledRatingStep('100', 'integer')).toBe(1);
    expect(scaledRatingStep('100', 'hundredths')).toBe(0.1);
    expect(scaledRatingStep('5', 'half')).toBe(0.5);
    expect(scaledRatingStep('5', 'hundredths')).toBe(0.01);
  });
});

describe('isValidScaledRating', () => {
  it('accepts empty (a run in progress has no rating)', () => {
    expect(isValidScaledRating(null, '100', 'integer')).toBe(true);
    expect(isValidScaledRating(undefined, '5', 'half')).toBe(true);
  });

  it('accepts 0..max and rejects anything outside', () => {
    const cases: [RatingScale, number][] = [
      ['10', 10],
      ['100', 100],
      ['5', 5],
    ];
    for (const [scale, max] of cases) {
      expect(isValidScaledRating(0, scale, 'integer')).toBe(true);
      expect(isValidScaledRating(max, scale, 'integer')).toBe(true);
      expect(isValidScaledRating(-0.01, scale, 'hundredths')).toBe(false);
      expect(isValidScaledRating(max + 0.01, scale, 'hundredths')).toBe(false);
    }
    expect(isValidScaledRating(Number.NaN, '10', 'hundredths')).toBe(false);
    expect(isValidScaledRating(Number.POSITIVE_INFINITY, '100', 'hundredths')).toBe(false);
  });

  it('enforces the precision step on each scale', () => {
    expect(isValidScaledRating(87, '100', 'integer')).toBe(true);
    expect(isValidScaledRating(87.5, '100', 'integer')).toBe(false);
    expect(isValidScaledRating(87.5, '100', 'half')).toBe(true);
    expect(isValidScaledRating(87.3, '100', 'half')).toBe(false);
    expect(isValidScaledRating(87.3, '100', 'hundredths')).toBe(true);
    expect(isValidScaledRating(87.35, '100', 'hundredths')).toBe(false);
    expect(isValidScaledRating(4, '5', 'integer')).toBe(true);
    expect(isValidScaledRating(4.5, '5', 'integer')).toBe(false);
    expect(isValidScaledRating(4.5, '5', 'half')).toBe(true);
    expect(isValidScaledRating(4.25, '5', 'half')).toBe(false);
    expect(isValidScaledRating(4.25, '5', 'hundredths')).toBe(true);
    expect(isValidScaledRating(4.255, '5', 'hundredths')).toBe(false);
    expect(isValidScaledRating(9.25, '10', 'hundredths')).toBe(true);
    expect(isValidScaledRating(9.255, '10', 'hundredths')).toBe(false);
  });
});

describe('isValidTypedRating', () => {
  it('applies the precision to new values', () => {
    expect(isValidTypedRating(87.5, '100', 'integer')).toBe(false);
    expect(isValidTypedRating(87, '100', 'integer')).toBe(true);
  });

  it('accepts the untouched stored rating whatever the precision', () => {
    // 8.75 shows as 87.5 on 0–100 and 4.375 on 0–5: both save as-is with integer precision.
    expect(isValidTypedRating(87.5, '100', 'integer', 8.75)).toBe(true);
    expect(isValidTypedRating(4.375, '5', 'integer', 8.75)).toBe(true);
    expect(isValidTypedRating(9.25, '10', 'integer', 9.25)).toBe(true);
  });

  it('still requires the kept value to be in range', () => {
    expect(isValidTypedRating(-1, '5', 'integer', 0)).toBe(false);
    expect(isValidTypedRating(101, '100', 'hundredths', 10)).toBe(false);
  });
});

describe('formatScaledRating', () => {
  it('shows the stored rating on the scale with the precision decimals', () => {
    expect(formatScaledRating(8.7, '10', 'hundredths', 'es-ES')).toBe('8,70');
    expect(formatScaledRating(8.75, '100', 'hundredths', 'es-ES')).toBe('87,5');
    expect(formatScaledRating(8.7, '100', 'integer', 'en-US')).toBe('87');
    expect(formatScaledRating(8.5, '5', 'hundredths', 'es-ES')).toBe('4,25');
    expect(formatScaledRating(8.75, '5', 'hundredths', 'en-US')).toBe('4.38');
    expect(formatScaledRating(8.75, '5', 'half', 'en-US')).toBe('4.4');
  });

  it('keeps the widest figure at five characters on every scale', () => {
    expect(formatScaledRating(10, '10', 'hundredths', 'es-ES')).toBe('10,00');
    expect(formatScaledRating(10, '100', 'hundredths', 'es-ES')).toBe('100,0');
    expect(formatScaledRating(10, '100', 'integer', 'es-ES')).toBe('100');
    expect(formatScaledRating(10, '5', 'hundredths', 'es-ES')).toBe('5,00');
  });

  it('renders missing values as an em dash', () => {
    expect(formatScaledRating(null, '100', 'integer')).toBe('—');
    expect(formatScaledRating(undefined, '5', 'half')).toBe('—');
    expect(formatScaledRating(Number.NaN, '10', 'half')).toBe('—');
  });
});

describe('scaledRatingDraft / formatScaledPoint', () => {
  it('writes the exact scaled value for an input, with the locale separator', () => {
    expect(scaledRatingDraft(8.75, '100', 'es')).toBe('87,5');
    expect(scaledRatingDraft(8.75, '5', 'en')).toBe('4.375');
    expect(scaledRatingDraft(9, '10', 'es')).toBe('9');
    expect(scaledRatingDraft(null, '100', 'es')).toBe('');
  });

  it('formats plain thresholds for copy', () => {
    expect(formatScaledPoint(10, '100', 'es')).toBe('100');
    expect(formatScaledPoint(9, '5', 'es')).toBe('4,5');
    expect(formatScaledPoint(4, '5', 'en')).toBe('2');
  });
});

describe('ratingInputParams', () => {
  it('gives the scale max and examples in the UI language', () => {
    expect(ratingInputParams('10', 'hundredths', 'es')).toEqual({ max: '10', example: '9,25', whole: '9' });
    expect(ratingInputParams('100', 'integer', 'en')).toEqual({ max: '100', example: '92', whole: '92' });
    expect(ratingInputParams('100', 'half', 'es')).toEqual({ max: '100', example: '92,5', whole: '92' });
    expect(ratingInputParams('5', 'hundredths', 'en')).toEqual({ max: '5', example: '4.25', whole: '4' });
  });

  it('only gives examples the validator accepts', () => {
    for (const scale of RATING_SCALES) {
      for (const precision of ['integer', 'half', 'hundredths'] as const) {
        const example = Number(ratingInputParams(scale, precision, 'en').example);
        expect(isValidScaledRating(example, scale, precision)).toBe(true);
      }
    }
  });
});
