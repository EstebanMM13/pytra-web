import { pageSlots } from './pagination';

describe('pageSlots', () => {
  it('lists every page when there are few', () => {
    expect(pageSlots(1, 1)).toEqual([1]);
    expect(pageSlots(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('collapses distant pages into gaps', () => {
    expect(pageSlots(1, 8)).toEqual([1, 2, 3, 4, 'gap', 8]);
    expect(pageSlots(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageSlots(8, 8)).toEqual([1, 'gap', 5, 6, 7, 8]);
  });
});
