import { ActivatedRouteSnapshot, ViewTransitionInfo, ViewTransitionsFeatureOptions } from '@angular/router';

/** Path of the primary route chain (`games/7`), without query params or fragment. */
export function routePath(root: ActivatedRouteSnapshot): string {
  const segments: string[] = [];
  for (let route: ActivatedRouteSnapshot | null = root; route; route = route.firstChild) {
    segments.push(...route.url.map((segment) => segment.path));
  }
  return segments.join('/');
}

/**
 * Router `onViewTransitionCreated`: only page changes cross-fade. A navigation that just rewrites
 * the query (library filters, search, pagination) skips the transition, because while one runs the
 * page is a frozen snapshot that takes no clicks: they land on `<html>`, which closes open popovers
 * (e.g. the library filter panel) and drops the next pick.
 */
export function skipSamePageTransition({ transition, from, to }: ViewTransitionInfo): void {
  if (routePath(from) === routePath(to)) {
    transition.skipTransition();
  }
}

/** The app's `withViewTransitions` options (shared with the tests). */
export const VIEW_TRANSITION_OPTIONS: ViewTransitionsFeatureOptions = {
  skipInitialTransition: true,
  onViewTransitionCreated: skipSamePageTransition,
};
