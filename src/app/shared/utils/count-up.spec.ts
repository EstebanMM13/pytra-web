import { countUpValue, easeOutCubic, parseCountUp } from './count-up';

describe('parseCountUp', () => {
  it('keeps decimals, separator and unit', () => {
    const parsed = parseCountUp('112,9 h')!;
    expect(parsed.target).toBe(112.9);
    expect(parsed.format(50)).toBe('50,0 h');
    expect(parseCountUp('9.25')!.format(4.5)).toBe('4.50');
    expect(parseCountUp('42')!.format(41.6)).toBe('42');
  });

  it('ignores non numeric figures', () => {
    expect(parseCountUp('3 / 10')).toBeNull();
    expect(parseCountUp('—')).toBeNull();
    expect(parseCountUp('1.234.567')).toBeNull();
  });
});

describe('easeOutCubic', () => {
  it('starts at 0, ends at 1 and front-loads the progress', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('clamps out-of-range progress', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe('countUpValue', () => {
  it('climbs towards the target and lands on it exactly', () => {
    expect(countUpValue(100, 0, 600)).toBe(0);
    expect(countUpValue(100, 300, 600)).toBeCloseTo(87.5);
    expect(countUpValue(100, 600, 600)).toBe(100);
    expect(countUpValue(100, 900, 600)).toBe(100);
  });

  it('shows the target at once without a duration', () => {
    expect(countUpValue(42, 0, 0)).toBe(42);
  });
});
