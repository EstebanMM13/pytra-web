import { ActivatedRouteSnapshot, UrlSegment, ViewTransitionInfo } from '@angular/router';
import { setMotionPreference } from '../shared/utils/motion';
import { routePath, skipSamePageTransition } from './view-transitions';

function snapshot(...paths: string[][]): ActivatedRouteSnapshot {
  let child: ActivatedRouteSnapshot | null = null;
  for (const segments of [...paths].reverse()) {
    child = { url: segments.map((p) => new UrlSegment(p, {})), firstChild: child } as unknown as ActivatedRouteSnapshot;
  }
  return child!;
}

function transitionInfo(from: ActivatedRouteSnapshot, to: ActivatedRouteSnapshot) {
  const skipTransition = vi.fn();
  const info = { transition: { skipTransition }, from, to } as unknown as ViewTransitionInfo;
  return { skipTransition, info };
}

describe('view transitions', () => {
  it('reads the primary route path', () => {
    expect(routePath(snapshot([], ['games', '7']))).toBe('games/7');
  });

  it('skips the cross-fade when only the query changes', () => {
    const { skipTransition, info } = transitionInfo(snapshot([], ['games']), snapshot([], ['games']));
    skipSamePageTransition(info);
    expect(skipTransition).toHaveBeenCalledOnce();
  });

  it('keeps the cross-fade between pages', () => {
    const { skipTransition, info } = transitionInfo(snapshot([], ['games']), snapshot([], ['games', '7']));
    skipSamePageTransition(info);
    expect(skipTransition).not.toHaveBeenCalled();
  });

  it('skips every transition with reduced motion', () => {
    setMotionPreference('reduce');
    const { skipTransition, info } = transitionInfo(snapshot([], ['games']), snapshot([], ['dashboard']));
    skipSamePageTransition(info);
    expect(skipTransition).toHaveBeenCalledOnce();
    setMotionPreference('system');
    delete document.documentElement.dataset['motion'];
  });
});
