import { ActivatedRouteSnapshot, ViewTransitionInfo, ViewTransitionsFeatureOptions } from '@angular/router';
import { prefersReducedMotion } from '../shared/utils/motion';
import { beginCoverTransition, coverSelection, settleCoverTransition } from '../shared/utils/cover-transition';

/** Path of the primary route chain (`games/7`), without query params or fragment. */
export function routePath(root: ActivatedRouteSnapshot): string {
  const segments: string[] = [];
  for (let route: ActivatedRouteSnapshot | null = root; route; route = route.firstChild) {
    segments.push(...route.url.map((segment) => segment.path));
  }
  return segments.join('/');
}

/**
 * How a page change animates (styles.css keys the animations off `<html data-nav-transition>`):
 * - `tab-forward` / `tab-back`: between main tabs, the page slides towards the picked tab (in the
 *   navbar order), like a carousel.
 * - `push` / `pop`: going deeper inside one tab (library -> game -> run, stats -> a stats page) the
 *   new page slides in from the right over the old one; going back reverses it.
 * - `fade`: anything else (sibling pages, profile, auth): the plain cross-fade.
 */
export type NavTransitionKind = 'tab-forward' | 'tab-back' | 'push' | 'pop' | 'fade';

/** `dataset` key of the `<html data-nav-transition>` attribute. */
export const NAV_TRANSITION_ATTR = 'navTransition';

/** Main tabs in navbar order, by the first path segment (years and sagas belong to stats). */
const TAB_INDEX: Readonly<Record<string, number>> = {
  dashboard: 0,
  games: 1,
  stats: 2,
  years: 2,
  sagas: 2,
  diary: 3,
  sync: 4,
};

export function navTransitionKind(fromPath: string, toPath: string): NavTransitionKind {
  const fromTab = TAB_INDEX[fromPath.split('/')[0]];
  const toTab = TAB_INDEX[toPath.split('/')[0]];
  if (fromTab === undefined || toTab === undefined) return 'fade';
  if (fromTab !== toTab) return toTab > fromTab ? 'tab-forward' : 'tab-back';
  if (toPath.startsWith(`${fromPath}/`)) return 'push';
  if (fromPath.startsWith(`${toPath}/`)) return 'pop';
  return 'fade';
}

/** Bumped per transition: a late `finished` only clears the mark it set. */
let navTransitionId = 0;

function markNavTransition(kind: NavTransitionKind, finished: Promise<void>): void {
  if (typeof document === 'undefined') return;
  const id = ++navTransitionId;
  const root = document.documentElement;
  root.dataset[NAV_TRANSITION_ATTR] = kind;
  const clear = (): void => {
    if (id === navTransitionId) delete root.dataset[NAV_TRANSITION_ATTR];
  };
  finished.then(clear, clear);
}

/**
 * Router `onViewTransitionCreated`: page changes animate by kind (see `navTransitionKind`). A navigation that just rewrites
 * the query (library filters, search, pagination) skips the transition, because while one runs the
 * page is a frozen snapshot that takes no clicks: they land on `<html>`, which closes open popovers
 * (e.g. the library filter panel) and drops the next pick. With reduced motion (OS or the in-app
 * Animations preference) every transition is skipped: the new page shows at once.
 */
export function skipSamePageTransition({ transition, from, to }: ViewTransitionInfo): void {
  const fromPath = routePath(from);
  const toPath = routePath(to);
  if (prefersReducedMotion() || fromPath === toPath) {
    transition.skipTransition();
  } else {
    markNavTransition(navTransitionKind(fromPath, toPath), transition.finished);
  }
  // Shared library cover (shared/utils/cover-transition.ts): never let a stale poster name linger.
  const startedAt = coverSelection();
  beginCoverTransition(toPath);
  transition.finished.then(
    () => settleCoverTransition(toPath, startedAt),
    () => settleCoverTransition(toPath, startedAt),
  );
}

/** The app's `withViewTransitions` options (shared with the tests). */
export const VIEW_TRANSITION_OPTIONS: ViewTransitionsFeatureOptions = {
  skipInitialTransition: true,
  onViewTransitionCreated: skipSamePageTransition,
};
