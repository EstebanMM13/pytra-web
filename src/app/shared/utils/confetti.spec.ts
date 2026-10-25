import { CONFETTI_COUNT, CONFETTI_LIFETIME_MS, burstConfetti, confettiParticles, shouldCelebrate } from './confetti';
import { setMotionPreference } from './motion';

describe('shouldCelebrate', () => {
  const run = (status: 'COMPLETADO' | 'EN_CURSO' | 'ABANDONADO', platinum = false) => ({ status, platinum });

  it('celebrates a new run saved as completed or with platinum', () => {
    expect(shouldCelebrate(run('COMPLETADO'), null, false)).toBe(true);
    expect(shouldCelebrate(run('EN_CURSO', true), null, false)).toBe(true);
    expect(shouldCelebrate(run('EN_CURSO'), null, false)).toBe(false);
    expect(shouldCelebrate(run('ABANDONADO'), null, false)).toBe(false);
  });

  it('celebrates an edit only when it reaches the milestone', () => {
    expect(shouldCelebrate(run('COMPLETADO'), run('EN_CURSO'), false)).toBe(true);
    expect(shouldCelebrate(run('COMPLETADO', true), run('COMPLETADO'), false)).toBe(true);
    expect(shouldCelebrate(run('COMPLETADO'), run('COMPLETADO'), false)).toBe(false);
    expect(shouldCelebrate(run('COMPLETADO', true), run('COMPLETADO', true), false)).toBe(false);
    expect(shouldCelebrate(run('EN_CURSO'), run('COMPLETADO'), false)).toBe(false);
  });

  it('celebrates reaching 100% once, like the platinum', () => {
    const hundred = { status: 'EN_CURSO' as const, platinum: false, fullCompletion: true };
    expect(shouldCelebrate(hundred, null, false)).toBe(true);
    expect(shouldCelebrate(hundred, run('EN_CURSO'), false)).toBe(true);
    expect(shouldCelebrate(hundred, hundred, false)).toBe(false);
  });

  it('never celebrates in the demo', () => {
    expect(shouldCelebrate(run('COMPLETADO', true), null, true)).toBe(false);
  });
});

describe('confettiParticles', () => {
  it('spreads ~20 brand-coloured particles from left to right', () => {
    const particles = confettiParticles(CONFETTI_COUNT, () => 0.5);
    expect(particles).toHaveLength(20);
    expect(particles[0].dx).toBeLessThan(0);
    expect(particles.at(-1)!.dx).toBeGreaterThan(0);
    for (const p of particles) {
      expect(p.rise).toBeGreaterThan(0);
      expect(p.fall).toBeGreaterThan(0);
      expect(p.delayMs + p.durationMs).toBeLessThan(CONFETTI_LIFETIME_MS);
    }
  });
});

describe('burstConfetti', () => {
  const originalMatchMedia = globalThis.matchMedia;
  const originalAnimate = HTMLElement.prototype.animate;

  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.matchMedia = ((query: string) =>
      ({ matches: false, media: query, addEventListener: () => undefined }) as unknown as MediaQueryList) as typeof matchMedia;
    HTMLElement.prototype.animate = vi.fn() as unknown as typeof HTMLElement.prototype.animate;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    globalThis.matchMedia = originalMatchMedia;
    HTMLElement.prototype.animate = originalAnimate;
    setMotionPreference('system');
    delete document.documentElement.dataset['motion'];
    document.querySelectorAll('[data-confetti]').forEach((el) => el.remove());
  });

  it('adds a decorative layer of particles and removes it after the burst', () => {
    burstConfetti();
    const layer = document.querySelector('[data-confetti]');
    expect(layer).not.toBeNull();
    expect(layer!.getAttribute('aria-hidden')).toBe('true');
    expect(layer!.children).toHaveLength(CONFETTI_COUNT);

    vi.advanceTimersByTime(CONFETTI_LIFETIME_MS);
    expect(document.querySelector('[data-confetti]')).toBeNull();
  });

  it('does nothing with reduced motion', () => {
    setMotionPreference('reduce');
    burstConfetti();
    expect(document.querySelector('[data-confetti]')).toBeNull();
  });
});
