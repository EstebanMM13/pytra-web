import { OnlinePlaytime } from '../../../core/models/online-playtime.model';
import { buildOnlinePlaytimeRequest, onlinePlaytimeErrorState } from './online-playtime.logic';

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
    });
    expect('platformIds' in request).toBe(false);
    expect(request).toEqual({ totalHours: 5, generalRating: null, lastSessionAt: null, notes: null });
  });

  it('sends an empty list when the user cleared the platforms', () => {
    const request = buildOnlinePlaytimeRequest({
      totalHours: 30,
      generalRating: 8,
      existing,
      platformIds: [],
      platformsTouched: true,
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
    });
    expect(request).toEqual({
      totalHours: 31.5,
      generalRating: 9,
      lastSessionAt: '2026-10-01T20:00:00',
      notes: 'Ranked',
      platformIds: [1, 2],
    });
  });

  it('sends platforms picked before the first save', () => {
    const request = buildOnlinePlaytimeRequest({
      totalHours: 1,
      generalRating: null,
      existing: null,
      platformIds: [3],
      platformsTouched: true,
    });
    expect(request.platformIds).toEqual([3]);
  });

  it('tells a missing record (404) from a failed load', () => {
    expect(onlinePlaytimeErrorState({ status: 404 })).toBe('missing');
    expect(onlinePlaytimeErrorState({ status: 500 })).toBe('error');
    expect(onlinePlaytimeErrorState({ status: 0 })).toBe('error');
    expect(onlinePlaytimeErrorState(null)).toBe('error');
  });
});
