import { HttpErrorResponse } from '@angular/common/http';
import { Experience } from '../../core/models/experience.model';
import { STEAM_RUN_LABEL, confirmErrorKey, findSteamRun, lookup, maskSteamId } from './steam.logic';

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
});
