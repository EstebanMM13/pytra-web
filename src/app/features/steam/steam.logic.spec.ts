import { HttpErrorResponse } from '@angular/common/http';
import { Experience } from '../../core/models/experience.model';
import { SteamStatus } from '../../core/models/steam.model';
import {
  STEAM_RUN_LABEL,
  applyPendingChange,
  confirmErrorKey,
  findSteamRun,
  lookup,
  maskSteamId,
  steamHours,
} from './steam.logic';

const run = (id: number, runLabel: string) => ({ id, runLabel }) as Experience;

describe('steam logic', () => {
  it('masks all but the first 10 digits of the SteamID', () => {
    expect(maskSteamId('76561198000000000')).toBe('7656119800•••••••');
    expect(maskSteamId(null)).toBe('');
  });

  it('finds the run the API created with the Steam hours', () => {
    expect(findSteamRun([run(1, 'Run 1'), run(2, STEAM_RUN_LABEL)])?.id).toBe(2);
    expect(findSteamRun([run(3, 'Renamed')])?.id).toBe(3);
    expect(findSteamRun([run(1, 'Run 1'), run(4, 'Run 2')])).toBeNull();
    expect(findSteamRun([])).toBeNull();
  });

  it('maps confirm errors', () => {
    const err = (status: number, message?: string) => new HttpErrorResponse({ status, error: { message } });
    expect(confirmErrorKey(err(409, 'SYNC_IN_PROGRESS'))).toBe('steam.errors.syncInProgress');
    expect(confirmErrorKey(err(409, 'Game already exists'))).toBe('steam.errors.duplicateName');
    expect(confirmErrorKey(err(500))).toBe('steam.errors.confirmFailed');
  });

  it('only looks up own keys', () => {
    expect(lookup({ A: 'a' }, 'constructor')).toBeNull();
    expect(lookup({ A: 'a' }, 'A')).toBe('a');
  });

  describe('status counters', () => {
    const status: SteamStatus = {
      linked: true,
      steamId: '1',
      personaName: 'p',
      lastSyncAt: null,
      configured: true,
      linkedGamesCount: 10,
      pendingCount: 2,
      ignoredCount: 0,
    };

    it('moves a pending game to ignored or linked', () => {
      expect(applyPendingChange(status, 'ignored')).toMatchObject({ pendingCount: 1, ignoredCount: 1, linkedGamesCount: 10 });
      expect(applyPendingChange(status, 'confirmed')).toMatchObject({ pendingCount: 1, ignoredCount: 0, linkedGamesCount: 11 });
    });

    it('never goes below zero', () => {
      expect(applyPendingChange(status, 'unignored').ignoredCount).toBe(0);
      expect(applyPendingChange({ ...status, pendingCount: 0 }, 'ignored').pendingCount).toBe(0);
    });
  });

  it('converts Steam minutes to hours', () => {
    expect(steamHours(90)).toBe(1.5);
    expect(steamHours(null)).toBe(0);
    expect(steamHours(-5)).toBe(0);
  });
});
