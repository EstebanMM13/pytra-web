import { barRatios } from './mini-bar-chart';

describe('barRatios', () => {
  it('scales bars against the tallest one', () => {
    expect(barRatios([10, 5, 0])).toEqual([1, 0.5, 0]);
  });

  it('keeps tiny non-zero bars visible and handles empty series', () => {
    expect(barRatios([1000, 1])).toEqual([1, 0.02]);
    expect(barRatios([0, 0])).toEqual([0, 0]);
    expect(barRatios([])).toEqual([]);
  });
});
