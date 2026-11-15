import { runTimeline } from './run-timeline.logic';

const TODAY = '2026-11-15';

describe('runTimeline', () => {
  it('goes from the start to the credits with the time between them', () => {
    const t = runTimeline(
      { status: 'COMPLETADO', startDate: '2026-10-01', endDate: '2026-10-21', postgame: false, postgameEndDate: null },
      TODAY,
    );
    expect(t.points).toEqual([
      { key: 'start', date: '2026-10-01', ongoing: false },
      { key: 'credits', date: '2026-10-21', ongoing: false },
    ]);
    expect(t.gaps).toEqual([{ unit: 'days', count: 20 }]);
    expect(t.total).toBeNull();
  });

  it('adds the postgame end and the total when the postgame ended', () => {
    const t = runTimeline(
      { status: 'COMPLETADO', startDate: '2026-01-10', endDate: '2026-02-01', postgame: false, postgameEndDate: '2026-05-01' },
      TODAY,
    );
    expect(t.points.map((p) => p.key)).toEqual(['start', 'credits', 'postgame']);
    expect(t.gaps).toEqual([
      { unit: 'days', count: 22 },
      { unit: 'months', count: 3 },
    ]);
    expect(t.total).toEqual({ unit: 'months', count: 3 });
  });

  it('runs an ongoing postgame until today', () => {
    const t = runTimeline(
      { status: 'COMPLETADO', startDate: '2026-11-01', endDate: '2026-11-05', postgame: true, postgameEndDate: null },
      TODAY,
    );
    expect(t.points[2]).toEqual({ key: 'postgame', date: null, ongoing: true });
    expect(t.gaps[1]).toEqual({ unit: 'days', count: 10 });
    expect(t.total).toEqual({ unit: 'days', count: 14 });
  });

  it('marks the credits ongoing while in progress and names an abandoned end', () => {
    const playing = runTimeline({ status: 'EN_CURSO', startDate: '2026-11-10', endDate: null }, TODAY);
    expect(playing.points[1]).toEqual({ key: 'credits', date: null, ongoing: true });
    expect(playing.gaps).toEqual([{ unit: 'days', count: 5 }]);

    const dropped = runTimeline({ status: 'ABANDONADO', startDate: null, endDate: '2026-03-01' }, TODAY);
    expect(dropped.points).toEqual([
      { key: 'start', date: null, ongoing: false },
      { key: 'abandoned', date: '2026-03-01', ongoing: false },
    ]);
    expect(dropped.gaps).toEqual([null]);
  });
});
