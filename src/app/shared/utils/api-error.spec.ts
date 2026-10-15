import { HttpErrorResponse } from '@angular/common/http';
import { describeApiError } from './api-error';

function httpError(status: number, error: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('describeApiError', () => {
  const fallback = 'game.saveError';

  it('names the duplicate instead of guessing', () => {
    expect(describeApiError(httpError(409, { message: 'Game already exists' }), fallback)).toEqual({
      key: 'errors.duplicateGame',
    });
    expect(describeApiError(httpError(409, { message: 'Saga already exists' }), fallback)?.key).toBe(
      'errors.duplicateSaga',
    );
  });

  it('maps platform limits and other stable codes', () => {
    expect(describeApiError(httpError(409, { message: 'PLATFORM_CATALOG_FULL' }), fallback)?.key).toBe(
      'errors.platformCatalogFull',
    );
    expect(describeApiError(httpError(429, { message: 'PLATFORM_RATE_LIMITED' }), fallback)?.key).toBe(
      'errors.platformRateLimited',
    );
    expect(describeApiError(httpError(400, { message: 'INVALID_PLATFORM' }), fallback)?.key).toBe(
      'errors.invalidPlatform',
    );
  });

  it('explains a known validation field, or shows the raw field message', () => {
    const known = httpError(400, { message: 'Validation failed', fieldErrors: { releaseDate: 'must be at most 10 years' } });
    expect(describeApiError(known, fallback)).toEqual({ key: 'errors.fields.releaseDate' });
    const other = httpError(400, { message: 'Validation failed', fieldErrors: { summary: 'too long' } });
    expect(describeApiError(other, fallback)).toEqual({
      key: 'errors.field',
      params: { field: 'summary', message: 'too long' },
    });
  });

  it('reports network and server failures', () => {
    expect(describeApiError(httpError(0), fallback)?.key).toBe('errors.network');
    expect(describeApiError(httpError(503), fallback)?.key).toBe('errors.server');
    expect(describeApiError(httpError(409, { message: 'something else' }), fallback)?.key).toBe('errors.conflict');
    expect(describeApiError(httpError(429), fallback)?.key).toBe('errors.tooManyRequests');
  });

  it('stays quiet when the error was already handled (demo read-only, expired session)', () => {
    expect(describeApiError(httpError(403, { message: 'DEMO_READ_ONLY' }), fallback)).toBeNull();
    expect(describeApiError(httpError(401), fallback)).toBeNull();
  });

  it('falls back to the caller key otherwise', () => {
    expect(describeApiError(httpError(400, { message: 'Nope' }), fallback)?.key).toBe(fallback);
    expect(describeApiError(new Error('boom'), fallback)?.key).toBe(fallback);
    expect(describeApiError(httpError(400, { message: 'constructor' }), fallback)?.key).toBe(fallback);
  });
});
