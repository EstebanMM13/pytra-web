import { ActivatedRouteSnapshot, UrlSegment, ViewTransitionInfo } from '@angular/router';
import { setMotionPreference } from '../shared/utils/motion';
import { markCoverTransition, posterTransitionName, resetCoverTransition } from '../shared/utils/cover-transition';
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
  const info = { transition: { skipTransition, finished: Promise.resolve() }, from, to } as unknown as ViewTransitionInfo;
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
  describe('shared library cover', () => {
    afterEach(() => resetCoverTransition());

    async function navigate(from: string[], to: string[]) {
      skipSamePageTransition(transitionInfo(snapshot([], from), snapshot([], to)).info);
      await Promise.resolve();
      await Promise.resolve();
    }

    it('keeps the tapped poster named on its game and its sub-pages, for the way back', async () => {
      markCoverTransition(7);
      await navigate(['games'], ['games', '7']);
      expect(posterTransitionName(7)).toBe('game-cover');
      await navigate(['games', '7'], ['games', '7', 'runs', '3']);
      expect(posterTransitionName(7)).toBe('game-cover');
    });

    it('drops the name when another game opens, so it never morphs the wrong poster', async () => {
      markCoverTransition(7);
      skipSamePageTransition(transitionInfo(snapshot([], ['games', '7']), snapshot([], ['games', '9'])).info);
      expect(posterTransitionName(7)).toBeNull();
    });

    it('drops the name once a navigation outside the game finishes (the way back is done)', async () => {
      markCoverTransition(7);
      await navigate(['games', '7'], ['games']);
      expect(posterTransitionName(7)).toBeNull();
    });

    it('leaves a newer tap alone when an older navigation finishes late', async () => {
      markCoverTransition(7);
      // Back to the library: its transition is still running...
      let finishBack!: () => void;
      const back = transitionInfo(snapshot([], ['games', '7']), snapshot([], ['games']));
      (back.info.transition as { finished: Promise<void> }).finished = new Promise<void>((resolve) => (finishBack = resolve));
      skipSamePageTransition(back.info);
      // ...when poster 9 is tapped and its game opens.
      markCoverTransition(9);
      skipSamePageTransition(transitionInfo(snapshot([], ['games']), snapshot([], ['games', '9'])).info);
      finishBack();
      await Promise.resolve();
      await Promise.resolve();
      expect(posterTransitionName(9)).toBe('game-cover');
    });
  });
});
