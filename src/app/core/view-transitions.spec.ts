import { ActivatedRouteSnapshot, UrlSegment, ViewTransitionInfo } from '@angular/router';
import { setMotionPreference } from '../shared/utils/motion';
import { markCoverTransition, posterTransitionName, resetCoverTransition } from '../shared/utils/cover-transition';
import { NAV_TRANSITION_ATTR, navTransitionKind, routePath, skipSamePageTransition } from './view-transitions';

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

  describe('navTransitionKind', () => {
    it('slides between main tabs towards the picked one', () => {
      expect(navTransitionKind('dashboard', 'games')).toBe('tab-forward');
      expect(navTransitionKind('games', 'stats')).toBe('tab-forward');
      expect(navTransitionKind('diary', 'dashboard')).toBe('tab-back');
      expect(navTransitionKind('sync', 'diary')).toBe('tab-back');
    });

    it('treats every page of a tab as that tab (years and sagas live under stats)', () => {
      expect(navTransitionKind('games/7', 'diary')).toBe('tab-forward');
      expect(navTransitionKind('years/2023', 'games')).toBe('tab-back');
      expect(navTransitionKind('stats/activity', 'dashboard')).toBe('tab-back');
    });

    it('pushes when going deeper inside a tab and pops on the way back', () => {
      expect(navTransitionKind('games', 'games/7')).toBe('push');
      expect(navTransitionKind('games/7', 'games/7/experiences/3')).toBe('push');
      expect(navTransitionKind('games/7/experiences/3', 'games/7')).toBe('pop');
      expect(navTransitionKind('games/7', 'games')).toBe('pop');
      expect(navTransitionKind('stats', 'stats/activity')).toBe('push');
    });

    it('cross-fades everything else', () => {
      expect(navTransitionKind('games/7', 'games/9')).toBe('fade');
      expect(navTransitionKind('stats/activity', 'stats/platforms')).toBe('fade');
      expect(navTransitionKind('dashboard', 'profile')).toBe('fade');
      expect(navTransitionKind('login', 'dashboard')).toBe('fade');
    });
  });

  describe('transition attribute', () => {
    const root = document.documentElement;
    afterEach(() => delete root.dataset[NAV_TRANSITION_ATTR]);

    it('marks <html> with the kind while the transition runs and clears it when it finishes', async () => {
      let finish!: () => void;
      const { info } = transitionInfo(snapshot([], ['games', '7']), snapshot([], ['games', '7', 'experiences', '3']));
      (info.transition as { finished: Promise<void> }).finished = new Promise<void>((resolve) => (finish = resolve));
      skipSamePageTransition(info);
      expect(root.dataset[NAV_TRANSITION_ATTR]).toBe('push');
      finish();
      await Promise.resolve();
      await Promise.resolve();
      expect(root.dataset[NAV_TRANSITION_ATTR]).toBeUndefined();
    });

    it('lets a newer transition keep its own mark when an older one finishes late', async () => {
      let finishOld!: () => void;
      const older = transitionInfo(snapshot([], ['dashboard']), snapshot([], ['games']));
      (older.info.transition as { finished: Promise<void> }).finished = new Promise<void>((resolve) => (finishOld = resolve));
      skipSamePageTransition(older.info);
      // The newer transition is still running when the older one settles.
      const newer = transitionInfo(snapshot([], ['games']), snapshot([], ['games', '7']));
      (newer.info.transition as { finished: Promise<void> }).finished = new Promise<void>(() => {});
      skipSamePageTransition(newer.info);
      finishOld();
      await Promise.resolve();
      await Promise.resolve();
      expect(root.dataset[NAV_TRANSITION_ATTR]).toBe('push');
    });
  });
});
