import { OnlinePlaytime } from '../../../core/models/online-playtime.model';
import {
  buildOnlinePlaytimeRequest,
  onlineFlagsOf,
  onlinePlaytimeErrorState,
  shouldCelebrateOnline,
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
