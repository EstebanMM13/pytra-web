import { HttpErrorResponse } from '@angular/common/http';
import { Experience } from '../../../core/models/experience.model';
import {
  PSN_ERROR_KEYS,
  PSN_RUN_LABEL,
  findPsnRun,
  isProfilePrivate,
  isValidOnlineId,
  normalizeOnlineId,
  psnErrorKey,
  psnHours,
} from './psn.logic';

const err = (status: number, message?: string) => new HttpErrorResponse({ status, error: { message } });
const run = (id: number, runLabel: string) => ({ id, runLabel }) as Experience;

describe('psn logic', () => {
  describe('online ID', () => {
    it('accepts 3-16 letters, digits, hyphens and underscores, ignoring surrounding spaces', () => {
      expect(isValidOnlineId('abc')).toBe(true);
      expect(isValidOnlineId('Player_One-2024a')).toBe(true);
      expect(isValidOnlineId('  Kratos_99  ')).toBe(true);
      expect(normalizeOnlineId('  Kratos_99  ')).toBe('Kratos_99');
    });

    it('rejects too short, too long, empty or invalid characters', () => {
      expect(isValidOnlineId('ab')).toBe(false);
      expect(isValidOnlineId('a'.repeat(17))).toBe(false);
      expect(isValidOnlineId('')).toBe(false);
      expect(isValidOnlineId(null)).toBe(false);
      expect(isValidOnlineId('player one')).toBe(false);
      expect(isValidOnlineId('player.one')).toBe(false);
      expect(isValidOnlineId('jugadór')).toBe(false);
    });
  });

  describe('error codes', () => {
    it.each([
      ['PSN_INVALID_ONLINE_ID', 400, 'psn.errors.invalidOnlineId'],
      ['PSN_USER_NOT_FOUND', 404, 'psn.errors.userNotFound'],
      ['PSN_PROFILE_PRIVATE', 422, 'psn.errors.profilePrivate'],
      ['PSN_NOT_LINKED', 404, 'psn.errors.notLinked'],
      ['SYNC_IN_PROGRESS', 409, 'psn.errors.syncInProgress'],
      ['PSN_LINK_CHANGED', 409, 'psn.errors.linkChanged'],
      ['PSN_RATE_LIMITED', 429, 'psn.errors.rateLimited'],
      ['PSN_NOT_CONFIGURED', 503, 'psn.errors.notConfigured'],
      ['PSN_UNAVAILABLE', 503, 'psn.errors.unavailable'],
    ])('maps %s to its message', (code, status, key) => {
      expect(psnErrorKey(err(status, code), 'fallback')).toBe(key);
    });

    it('covers every documented code', () => {
      expect(Object.keys(PSN_ERROR_KEYS)).toHaveLength(9);
    });

    it('falls back for unknown codes, missing bodies and prototype keys', () => {
      expect(psnErrorKey(err(500, 'BOOM'), 'psn.errors.syncFailed')).toBe('psn.errors.syncFailed');
      expect(psnErrorKey(new HttpErrorResponse({ status: 0 }), 'psn.errors.linkFailed')).toBe(
        'psn.errors.linkFailed',
      );
      expect(psnErrorKey(err(400, 'constructor'), 'x')).toBe('x');
    });

    it('detects a private profile', () => {
      expect(isProfilePrivate(err(422, 'PSN_PROFILE_PRIVATE'))).toBe(true);
      expect(isProfilePrivate(err(404, 'PSN_USER_NOT_FOUND'))).toBe(false);
    });
  });

  it('converts PSN minutes to hours', () => {
    expect(psnHours(90)).toBe(1.5);
    expect(psnHours(600)).toBe(10);
    expect(psnHours(0)).toBe(0);
    expect(psnHours(null)).toBe(0);
    expect(psnHours(undefined)).toBe(0);
    expect(psnHours(-5)).toBe(0);
  });

  it('finds the run the API created with the PSN hours', () => {
    expect(findPsnRun([run(1, 'Run 1'), run(2, PSN_RUN_LABEL)])?.id).toBe(2);
    expect(findPsnRun([run(3, 'Renamed')])?.id).toBe(3);
    expect(findPsnRun([run(1, 'Run 1'), run(4, 'Run 2')])).toBeNull();
  });
});
