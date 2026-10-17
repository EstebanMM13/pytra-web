import { canAnimate, prefersReducedMotion, resolveMotion, setMotionPreference } from './motion';

describe('motion preferences', () => {
  const original = globalThis.matchMedia;

  afterEach(() => {
    globalThis.matchMedia = original;
    setMotionPreference('system');
    delete document.documentElement.dataset['motion'];
  });

  function mockReducedMotion(reduce: boolean): void {
    globalThis.matchMedia = ((query: string) =>
      ({
        matches: reduce && query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof matchMedia;
  }

  it('reads the reduced-motion media query while the preference is system', () => {
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

  it('resolves an explicit preference over the OS setting', () => {
    expect(resolveMotion('system', true)).toBe('reduce');
    expect(resolveMotion('system', false)).toBe('full');
    expect(resolveMotion('full', true)).toBe('full');
    expect(resolveMotion('reduce', false)).toBe('reduce');
  });

  it('gives the in-app preference precedence: reduce > OS, full > OS', () => {
    mockReducedMotion(false);
    setMotionPreference('reduce');
    expect(prefersReducedMotion()).toBe(true);
    expect(canAnimate()).toBe(false);

    mockReducedMotion(true);
    setMotionPreference('full');
    expect(prefersReducedMotion()).toBe(false);
    expect(canAnimate()).toBe(typeof requestAnimationFrame === 'function');

    setMotionPreference('system');
    expect(prefersReducedMotion()).toBe(true);
  });

  it('mirrors the effective mode on <html data-motion>', () => {
    mockReducedMotion(true);
    setMotionPreference('system');
    expect(document.documentElement.dataset['motion']).toBe('reduce');

    setMotionPreference('full');
    expect(document.documentElement.dataset['motion']).toBe('full');

    mockReducedMotion(false);
    setMotionPreference('reduce');
    expect(document.documentElement.dataset['motion']).toBe('reduce');
  });
});
