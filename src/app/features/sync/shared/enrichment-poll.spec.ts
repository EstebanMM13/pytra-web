import { Observable, of, throwError } from 'rxjs';
import { ENRICHMENT_POLL_INTERVAL_MS, ENRICHMENT_POLL_MAX_MS, EnrichmentProgress } from '../sync.logic';
import { EnrichmentSnapshot, pollWhileEnriching } from './enrichment-poll';

type Status = { enrichment?: EnrichmentProgress | null };
type Snapshot = EnrichmentSnapshot<Status, { id: number }>;

const active = (processed: number): Snapshot => ({
  status: { enrichment: { active: true, processed, total: 10 } },
  pending: [{ id: processed }],
});
const done: Snapshot = { status: { enrichment: { active: false, processed: 0, total: 0 } }, pending: [] };

describe('pollWhileEnriching', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function run(refresh: () => Observable<Snapshot>, isHidden: () => boolean = () => false) {
    const seen: Snapshot[] = [];
    let completed = false;
    pollWhileEnriching(refresh, isHidden).subscribe({
      next: (s) => seen.push(s),
      complete: () => (completed = true),
    });
    return { seen, isCompleted: () => completed };
  }

  it('refreshes on every tick and completes after the refresh that reports the fill done', () => {
    const answers = [active(1), active(2), done];
    const refresh = vi.fn(() => of(answers.shift()!));
    const { seen, isCompleted } = run(refresh);

    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ENRICHMENT_POLL_INTERVAL_MS * 3);

    expect(seen).toEqual([active(1), active(2), done]);
    expect(isCompleted()).toBe(true);
    vi.advanceTimersByTime(ENRICHMENT_POLL_INTERVAL_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('sends nothing while the page is hidden', () => {
    let hidden = true;
    const refresh = vi.fn(() => of(active(1)));
    run(refresh, () => hidden);

    vi.advanceTimersByTime(ENRICHMENT_POLL_INTERVAL_MS * 4);
    expect(refresh).not.toHaveBeenCalled();

    hidden = false;
    vi.advanceTimersByTime(ENRICHMENT_POLL_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('skips a failed refresh and keeps going', () => {
    const refresh = vi
      .fn<() => Observable<Snapshot>>()
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValue(of(done));
    const { seen, isCompleted } = run(refresh);

    vi.advanceTimersByTime(ENRICHMENT_POLL_INTERVAL_MS * 2);

    expect(seen).toEqual([done]);
    expect(isCompleted()).toBe(true);
  });

  it('does not count hidden time towards the cap (app in the background)', () => {
    let hidden = true;
    const refresh = vi.fn(() => of(active(1)));
    const { isCompleted } = run(refresh, () => hidden);

    vi.advanceTimersByTime(ENRICHMENT_POLL_MAX_MS * 2);
    expect(isCompleted()).toBe(false);

    hidden = false;
    vi.advanceTimersByTime(ENRICHMENT_POLL_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(isCompleted()).toBe(false);
  });

  it('gives up after the cap of visible time even if the fill is still active', () => {
    const refresh = vi.fn(() => of(active(1)));
    const { isCompleted } = run(refresh);

    vi.advanceTimersByTime(ENRICHMENT_POLL_MAX_MS + ENRICHMENT_POLL_INTERVAL_MS);

    expect(isCompleted()).toBe(true);
    expect(refresh.mock.calls.length).toBeLessThanOrEqual(ENRICHMENT_POLL_MAX_MS / ENRICHMENT_POLL_INTERVAL_MS);
  });
});
