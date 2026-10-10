import { sparklinePoints } from './sparkline';

describe('sparklinePoints', () => {
  it('needs at least two values', () => {
    expect(sparklinePoints([])).toEqual([]);
    expect(sparklinePoints([5])).toEqual([]);
  });

  it('spans the box with min at the bottom and max at the top', () => {
    expect(sparklinePoints([0, 10], 60, 18, 0)).toEqual([
      [0, 18],
      [60, 0],
    ]);
  });

  it('centers a flat series', () => {
    expect(sparklinePoints([3, 3, 3], 60, 18, 0).map(([, y]) => y)).toEqual([9, 9, 9]);
  });
});
