/**
 * Theme switches with a forced full repaint.
 *
 * Android WebView (Chromium) can leave composited layers unpainted when the theme's CSS custom
 * properties change in place: elements with `backdrop-filter` (card-glass, nav-glass) and
 * promoted layers keep stale/blank tiles until something invalidates them (a scroll, a
 * navigation). To avoid it, the swap runs under `<html data-theme-switching>`, which (styles.css)
 * drops `backdrop-filter` and transitions for a couple of frames: those layers are torn down and
 * rebuilt with the new palette, then the blur comes back on a clean repaint.
 */

export const THEME_SWITCHING_ATTR = 'themeSwitching';

type FrameScheduler = (callback: () => void) => unknown;

function defaultScheduler(): FrameScheduler {
  if (typeof requestAnimationFrame === 'function') {
    return (callback) => requestAnimationFrame(() => callback());
  }
  return (callback) => setTimeout(callback, 16);
}

/**
 * Runs `apply` (the attribute / meta swap) inside a forced repaint: flags `<html>`, applies the
 * change, forces a synchronous style/layout flush, then clears the flag two frames later so the
 * restored effects paint against the new theme. Overlapping calls keep the flag until the last
 * one settles.
 */
let pending = 0;

export function applyWithRepaint(
  apply: () => void,
  root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement,
  nextFrame: FrameScheduler = defaultScheduler(),
): void {
  if (!root) {
    apply();
    return;
  }
  pending++;
  root.dataset[THEME_SWITCHING_ATTR] = '';
  apply();
  // Reading layout forces the new styles (no backdrop-filter, new tokens) to be resolved now.
  void root.offsetHeight;
  nextFrame(() =>
    nextFrame(() => {
      pending = Math.max(0, pending - 1);
      if (pending === 0) {
        delete root.dataset[THEME_SWITCHING_ATTR];
      }
    }),
  );
}

/** Test hook: resets the overlapping-call counter. */
export function resetRepaintStateForTests(): void {
  pending = 0;
}
