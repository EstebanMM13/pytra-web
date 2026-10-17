import { canAnimate, prefersReducedMotion } from './motion';

describe('motion preferences', () => {
  const original = globalThis.matchMedia;

  afterEach(() => {
    globalThis.matchMedia = original;
  });

  function mockReducedMotion(reduce: boolean): void {
    globalThis.matchMedia = ((query: string) =>
      ({ matches: reduce && query === '(prefers-reduced-motion: reduce)', media: query }) as MediaQueryList) as typeof matchMedia;
  }

  it('reads the reduced-motion media query', () => {
    mockReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(canAnimate()).toBe(false);

    mockReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('never animates without matchMedia (tests, SSR): the final state renders at once', () => {
    (globalThis as { matchMedia?: unknown }).matchMedia = undefined;
    expect(prefersReducedMotion()).toBe(false);
    expect(canAnimate()).toBe(false);
  });

  it('animates with matchMedia, requestAnimationFrame and no reduced motion', () => {
    mockReducedMotion(false);
    expect(canAnimate()).toBe(typeof requestAnimationFrame === 'function');
  });
});
