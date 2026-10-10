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

  it('drops decimals for totals of 1000 h or more', () => {
    expect(pipe.transform(3748.7)).toBe('3749 h'.replace('3749', new Intl.NumberFormat('es-ES', { useGrouping: true }).format(3749)));
  });

  it('treats missing values as zero', () => {
    expect(pipe.transform(null)).toBe('0 h');
    expect(pipe.transform(undefined)).toBe('0 h');
  });
});
