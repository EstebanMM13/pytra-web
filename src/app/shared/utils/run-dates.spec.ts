import { formatDayMonthYear, formatRunPeriod, runDuration, runYear, splitLines, todayIso } from './run-dates';
import { ratingRank } from '../../features/games/experience-detail/experience-detail';

describe('run dates', () => {
  it('formats ISO dates as dd/mm/yyyy', () => {
    expect(formatDayMonthYear('2023-02-25')).toBe('25/02/2023');
    expect(formatDayMonthYear(null)).toBe('—');
  });

  it('builds today in local time', () => {
    expect(todayIso(new Date(2026, 9, 9))).toBe('2026-10-09');
  });

  it('counts whole months between dates, falling back to days', () => {
    expect(runDuration('2023-02-25', '2024-06-30')).toEqual({ unit: 'months', count: 16 });
    expect(runDuration('2024-01-31', '2024-02-29')).toEqual({ unit: 'days', count: 29 });
    expect(runDuration('2024-05-01', null)).toBeNull();
    expect(runDuration('2024-05-02', '2024-05-01')).toBeNull();
  });

  it('formats a compact run period', () => {
    expect(formatRunPeriod('2025-01-10', '2025-04-02')).toBe('ene – abr 2025');
    expect(formatRunPeriod('2020-03-01', '2021-05-01')).toBe('mar 2020 – may 2021');
    expect(formatRunPeriod('2026-09-04', null)).toBe('sept 2026');
    expect(formatRunPeriod(null, null)).toBeNull();
  });

  it('resolves the run year like the API', () => {
    expect(runYear({ year: 2019, startDate: '2020-01-01', endDate: null })).toBe(2019);
    expect(runYear({ year: null, startDate: '2020-01-01', endDate: '2021-01-01' })).toBe(2021);
    expect(runYear({ year: null, startDate: null, endDate: null })).toBeNull();
  });

  it('splits list text into items, dropping bullets and blank lines', () => {
    expect(splitLines('- Combate\n\n* Arte \r\n+ Música\n• Final')).toEqual(['Combate', 'Arte', 'Música', 'Final']);
    expect(splitLines(null)).toEqual([]);
  });
});

describe('ratingRank', () => {
  it('ranks among the best-first window, ties sharing a position', () => {
    expect(ratingRank(9, [10, 9, 9, 8])).toBe(2);
    expect(ratingRank(10, [10, 9])).toBe(1);
  });

  it('is unknown when a full window does not reach the rating', () => {
    expect(ratingRank(5, [9, 8, 7], 3)).toBeNull();
    expect(ratingRank(7, [9, 8, 7], 3)).toBe(3);
  });
});
