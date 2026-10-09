import { HoursPipe } from './hours.pipe';

describe('HoursPipe', () => {
  const pipe = new HoursPipe();

  it('rounds to one decimal with a Spanish decimal comma', () => {
    expect(pipe.transform(112.91666666666667)).toBe('112,9 h');
  });

  it('drops the decimal part for whole hours', () => {
    expect(pipe.transform(6.8)).toBe('6,8 h');
    expect(pipe.transform(22)).toBe('22 h');
  });

  it('treats missing values as zero', () => {
    expect(pipe.transform(null)).toBe('0 h');
    expect(pipe.transform(undefined)).toBe('0 h');
  });
});
