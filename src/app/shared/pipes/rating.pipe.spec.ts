import { RatingPipe } from './rating.pipe';

describe('RatingPipe', () => {
  const pipe = new RatingPipe();

  it('keeps up to two decimals with a dot separator', () => {
    expect(pipe.transform(9.25)).toBe('9.25');
    expect(pipe.transform(8.083333)).toBe('8.08');
  });

  it('drops trailing zeros', () => {
    expect(pipe.transform(8)).toBe('8');
    expect(pipe.transform(7.5)).toBe('7.5');
  });

  it('renders missing values as an em dash', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
  });
});
