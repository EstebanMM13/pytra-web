/**
 * Whether the user asked the OS to minimise motion. False where `matchMedia` is missing (jsdom,
 * SSR), which never animates anyway (see `canAnimate`).
 */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Whether a script-driven animation (count-up) should run. It needs `requestAnimationFrame` and
 * `matchMedia`; without them (tests, SSR) or with reduced motion the final state renders at once.
 */
export function canAnimate(): boolean {
  return typeof requestAnimationFrame === 'function' && typeof matchMedia === 'function' && !prefersReducedMotion();
}
