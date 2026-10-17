import { TestBed } from '@angular/core/testing';
import { setMotionPreference } from '../utils/motion';
import { SplashOverlay } from './splash-overlay';
import {
  SLOGAN_WORD_MS,
  SPLASH_FADE_OUT_START_MS,
  SPLASH_TOTAL_MS,
  shouldShowSplash,
  sloganTokens,
} from './splash.logic';

describe('splash logic', () => {
  it('shows only inside the native shell and never with reduced motion', () => {
    expect(shouldShowSplash(true, false)).toBe(true);
    expect(shouldShowSplash(false, false)).toBe(false);
    expect(shouldShowSplash(true, true)).toBe(false);
    expect(shouldShowSplash(false, true)).toBe(false);
  });

  it('reveals "Play · Track · Remember" word by word, each dot with its next word', () => {
    const tokens = sloganTokens();
    expect(tokens.map((t) => t.text)).toEqual(['Play', '·', 'Track', '·', 'Remember']);
    expect(tokens[1].delayMs).toBe(tokens[2].delayMs);
    expect(tokens[0].delayMs).toBeLessThan(tokens[2].delayMs);
    expect(tokens[2].delayMs).toBeLessThan(tokens[4].delayMs);
  });

  it('finishes the slogan before the fade-out and the whole intro within 1.4 s', () => {
    const lastWordEnd = Math.max(...sloganTokens().map((t) => t.delayMs)) + SLOGAN_WORD_MS;
    expect(lastWordEnd).toBeLessThanOrEqual(SPLASH_FADE_OUT_START_MS);
    expect(SPLASH_TOTAL_MS).toBeLessThanOrEqual(1400);
  });
});

describe('SplashOverlay', () => {
  const win = globalThis as { androidBridge?: unknown };

  afterEach(() => {
    delete win.androidBridge;
    setMotionPreference('system');
    delete document.documentElement.dataset['motion'];
    vi.useRealTimers();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(SplashOverlay);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders nothing on the web', () => {
    expect(render().querySelector('[data-splash]')).toBeNull();
  });

  it('renders nothing on native with reduced motion', () => {
    win.androidBridge = {};
    setMotionPreference('reduce');
    expect(render().querySelector('[data-splash]')).toBeNull();
  });

  it('plays on native and removes itself after the intro', () => {
    vi.useFakeTimers();
    win.androidBridge = {};
    const fixture = TestBed.createComponent(SplashOverlay);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-splash]')).not.toBeNull();
    expect(el.textContent).toContain('Remember');

    vi.advanceTimersByTime(SPLASH_TOTAL_MS - 1);
    fixture.detectChanges();
    expect(el.querySelector('[data-splash]')).not.toBeNull();

    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(el.querySelector('[data-splash]')).toBeNull();
  });

  it('a tap skips the intro at once', () => {
    win.androidBridge = {};
    const fixture = TestBed.createComponent(SplashOverlay);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('[data-splash]')!.dispatchEvent(new Event('pointerdown'));
    fixture.detectChanges();
    expect(el.querySelector('[data-splash]')).toBeNull();
  });
});
