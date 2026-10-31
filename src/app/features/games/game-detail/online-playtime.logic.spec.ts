import { OnlinePlaytime } from '../../../core/models/online-playtime.model';
import {
  buildOnlinePlaytimeRequest,
  onlineFlagsOf,
  onlinePlaytimeErrorState,
  parsePlatformHours,
  platformHoursInputsOf,
  shouldCelebrateOnline,
  totalWithout,
  unassignedHoursOf,
} from './online-playtime.logic';

const existing: OnlinePlaytime = {
  id: 4,
  gameId: 2,
  totalHours: 30,
  lastSessionAt: '2026-10-01T20:00:00',
  generalRating: 8,
  notes: 'Ranked',
  platforms: [{ id: 1, name: 'PC', color: null }],
};

describe('online playtime request', () => {
  it('omits platformIds without a stored record when the picker was not touched', () => {
    const request = buildOnlinePlaytimeRequest({
      totalHours: 5,
      generalRating: null,
      existing: null,
      platformIds: [],
      platformsTouched: false,
      platinum: false,
      fullCompletion: false,
    });
    expect('platformIds' in request).toBe(false);
    expect(request).toEqual({
      totalHours: 5,
      generalRating: null,
      lastSessionAt: null,
      notes: null,
      platinum: false,
      fullCompletion: false,
    });
  });

  it('sends an empty list when the user cleared the platforms', () => {
    const request = buildOnlinePlaytimeRequest({
      totalHours: 30,
      generalRating: 8,
      existing,
      platformIds: [],
      platformsTouched: true,
      platinum: false,
      fullCompletion: false,
    });
    expect(request.platformIds).toEqual([]);
  });

  it('sends the picked platforms and keeps the fields the card does not edit', () => {
    const request = buildOnlinePlaytimeRequest({
      totalHours: 31.5,
      generalRating: 9,
      existing,
      platformIds: [1, 2],
      platformsTouched: false,
      platinum: false,
      fullCompletion: false,
    });
    expect(request).toEqual({
      totalHours: 31.5,
      generalRating: 9,
      lastSessionAt: '2026-10-01T20:00:00',
      notes: 'Ranked',
      platformIds: [1, 2],
      platinum: false,
      fullCompletion: false,
    });
  });

  it('sends platforms picked before the first save', () => {
    const request = buildOnlinePlaytimeRequest({
      totalHours: 1,
      generalRating: null,
      existing: null,
      platformIds: [3],
      platformsTouched: true,
      platinum: false,
      fullCompletion: false,
    });
    expect(request.platformIds).toEqual([3]);
  });

  it('sends the card flags independently of each other', () => {
    const request = buildOnlinePlaytimeRequest({
      totalHours: 300,
      generalRating: null,
      existing,
      platformIds: [1],
      platformsTouched: false,
      platinum: false,
      fullCompletion: true,
    });
    expect(request.platinum).toBe(false);
    expect(request.fullCompletion).toBe(true);
  });

  it('tells a missing record (404) from a failed load', () => {
    expect(onlinePlaytimeErrorState({ status: 404 })).toBe('missing');
    expect(onlinePlaytimeErrorState({ status: 500 })).toBe('error');
    expect(onlinePlaytimeErrorState({ status: 0 })).toBe('error');
    expect(onlinePlaytimeErrorState(null)).toBe('error');
  });
});

describe('online flags', () => {
  it('reads absent flags (older API) as false', () => {
    expect(onlineFlagsOf(null)).toEqual({ platinum: false, fullCompletion: false });
    expect(onlineFlagsOf(existing)).toEqual({ platinum: false, fullCompletion: false });
    expect(onlineFlagsOf({ ...existing, platinum: true })).toEqual({ platinum: true, fullCompletion: false });
  });

  it('celebrates reaching a flag only', () => {
    const none = { platinum: false, fullCompletion: false };
    expect(shouldCelebrateOnline({ platinum: true, fullCompletion: false }, none, false)).toBe(true);
    expect(shouldCelebrateOnline({ platinum: false, fullCompletion: true }, none, false)).toBe(true);
    expect(shouldCelebrateOnline({ platinum: true, fullCompletion: false }, { platinum: true, fullCompletion: false }, false)).toBe(false);
    expect(shouldCelebrateOnline(none, { platinum: true, fullCompletion: true }, false)).toBe(false);
    expect(shouldCelebrateOnline({ platinum: true, fullCompletion: true }, none, true)).toBe(false);
  });
});

describe('online platform hours', () => {
  const base = {
    totalHours: 30,
    generalRating: 8,
    existing,
    platformIds: [1, 2],
    platformsTouched: false,
    platinum: false,
    fullCompletion: false,
  };

  it('sends the per-platform hours when given and leaves them out otherwise', () => {
    expect(buildOnlinePlaytimeRequest({ ...base, platformHours: { 1: 10, 2: 5.5 } }).platformHours).toEqual({
      1: 10,
      2: 5.5,
    });
    expect('platformHours' in buildOnlinePlaytimeRequest(base)).toBe(false);
  });

  it('turns the stored hours into inputs for the picked platforms', () => {
    const playtime: OnlinePlaytime = { ...existing, platformHours: { '1': 12.5, '9': 3 } };
    expect(platformHoursInputsOf(playtime, [1, 2], 'es')).toEqual({ 1: '12,5', 2: '' });
    expect(platformHoursInputsOf(null, [1, 2], 'es')).toEqual({ 1: '', 2: '' });
  });

  it('parses the inputs: blank is unassigned and the rest is what is left of the total', () => {
    expect(parsePlatformHours({ 1: '12,5', 2: '' }, [1, 2], 30)).toEqual({
      hours: { 1: 12.5 },
      assigned: 12.5,
      unassigned: 17.5,
      over: 0,
      error: null,
    });
  });

  it('rejects unparsable or negative hours and a split above the total', () => {
    expect(parsePlatformHours({ 1: 'abc', 2: '' }, [1, 2], 30).error).toBe('invalid');
    expect(parsePlatformHours({ 1: '-1', 2: '' }, [1, 2], 30).error).toBe('invalid');
    expect(parsePlatformHours({ 1: '20', 2: '10,5' }, [1, 2], 30)).toMatchObject({ error: 'exceedsTotal', over: 0.5 });
  });
});

describe('online total from the platforms', () => {
  it('finds the stored hours on no platform and the total without removed platforms', () => {
    const playtime: OnlinePlaytime = { ...existing, totalHours: 30, platformHours: { '1': 10, '2': 15 } };
    expect(unassignedHoursOf(playtime)).toBe(5);
    expect(unassignedHoursOf({ ...existing, totalHours: 8, platformHours: {} })).toBe(8);
    expect(totalWithout(playtime, [1])).toBe(15);
  });
});
