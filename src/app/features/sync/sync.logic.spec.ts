import {
  ENRICHMENT_POLL_MAX_MS,
  EnrichmentProgress,
  enrichmentCount,
  mergePending,
  mergePolledStatus,
  shouldKeepPolling,
} from './sync.logic';

const progress = (overrides: Partial<EnrichmentProgress> = {}): EnrichmentProgress => ({
  active: true,
  processed: 0,
  total: 0,
  ...overrides,
});

describe('shouldKeepPolling', () => {
  it('keeps polling while the fill is active', () => {
    expect(shouldKeepPolling(progress(), 0)).toBe(true);
  });

  it('stops once the fill is done or the API does not report it', () => {
    expect(shouldKeepPolling(progress({ active: false }), 0)).toBe(false);
    expect(shouldKeepPolling(undefined, 0)).toBe(false);
    expect(shouldKeepPolling(null, 0)).toBe(false);
  });

  it('stops at the time cap even if the fill is still active', () => {
    expect(shouldKeepPolling(progress(), ENRICHMENT_POLL_MAX_MS - 1)).toBe(true);
    expect(shouldKeepPolling(progress(), ENRICHMENT_POLL_MAX_MS)).toBe(false);
  });
});

describe('mergePending', () => {
  it('takes the fresh rows in the server order', () => {
    const fresh = [
      { id: 1, name: 'A (filled)' },
      { id: 3, name: 'C' },
    ];

    expect(mergePending(fresh, new Set())).toEqual(fresh);
  });

  it('never brings back rows confirmed or ignored here meanwhile', () => {
    const fresh = [{ id: 1 }, { id: 2 }, { id: 3 }];

    expect(mergePending(fresh, new Set([2]))).toEqual([{ id: 1 }, { id: 3 }]);
  });
});

describe('mergePolledStatus', () => {
  const local = { pendingCount: 1, ignoredCount: 3, enrichment: progress({ processed: 1, total: 4 }) };
  const polled = { pendingCount: 2, ignoredCount: 2, enrichment: progress({ processed: 2, total: 4 }) };

  it('takes the polled status when no local change happened meanwhile', () => {
    expect(mergePolledStatus(local, polled, false)).toEqual(polled);
  });

  it('keeps the local counters of a stale answer but takes its fill progress', () => {
    expect(mergePolledStatus(local, polled, true)).toEqual({ ...local, enrichment: polled.enrichment });
  });

  it('takes a stale answer as is when nothing is shown yet', () => {
    expect(mergePolledStatus(null, polled, true)).toEqual(polled);
  });
});

describe('enrichmentCount', () => {
  it('gives the count while a running fill knows its total', () => {
    expect(enrichmentCount(progress({ processed: 4, total: 10 }))).toEqual({ processed: 4, total: 10 });
  });

  it('has no count while queued or idle', () => {
    expect(enrichmentCount(progress({ total: 0 }))).toBeNull();
    expect(enrichmentCount(progress({ active: false, processed: 2, total: 2 }))).toBeNull();
    expect(enrichmentCount(undefined)).toBeNull();
  });

  it('never shows more processed than total', () => {
    expect(enrichmentCount(progress({ processed: 12, total: 10 }))).toEqual({ processed: 10, total: 10 });
  });
});
