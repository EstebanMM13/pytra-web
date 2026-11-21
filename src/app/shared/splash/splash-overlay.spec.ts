import { TestBed } from '@angular/core/testing';
import { LAUNCH_SPLASH_DEPS, LaunchSplash } from '../../core/services/launch-splash.service';
import { setMotionPreference } from '../utils/motion';
import { SplashOverlay } from './splash-overlay';
import {
  MARK_CONTENT_CENTER,
  NATIVE_MARK_SCALE,
  SETTLED_MARK_PX,
  SLOGAN_WORD_MS,
  SPLASH_FADE_OUT_START_MS,
  SPLASH_TOTAL_MS,
  emblemBox,
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

  it('starts the mark at the native splash icon: same size, content centred on the screen', () => {
    const box = emblemBox();
    expect(box.size).toBeCloseTo(100 * NATIVE_MARK_SCALE);
    // The content centre lands on the screen centre (offset 0, 0).
    expect(box.left + (MARK_CONTENT_CENTER.x / 100) * box.size).toBeCloseTo(0);
    expect(box.top + (MARK_CONTENT_CENTER.y / 100) * box.size).toBeCloseTo(0);
    expect(box.origin).toBe('54% 50%');
  });

  it('settles the mark to 88 px with the text block below it', () => {
    const box = emblemBox();
    expect(box.size * box.settleScale).toBeCloseTo(SETTLED_MARK_PX);
    // Settled mark bottom = rise above centre + half the settled size; the text starts below it.
    expect(box.textTop).toBeGreaterThan(-45 + SETTLED_MARK_PX / 2);
  });

  it('finishes the slogan before the fade-out and the whole intro within 1.4 s', () => {
    const lastWordEnd = Math.max(...sloganTokens().map((t) => t.delayMs)) + SLOGAN_WORD_MS;
    expect(lastWordEnd).toBeLessThanOrEqual(SPLASH_FADE_OUT_START_MS);
    expect(SPLASH_TOTAL_MS).toBeLessThanOrEqual(1400);
  });
});

describe('SplashOverlay', () => {
  const win = globalThis as { androidBridge?: unknown };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: LAUNCH_SPLASH_DEPS, useValue: { native: true, hideNative: () => Promise.resolve() } }],
    });
  });

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

  it('holds its first frame while the system splash is up', () => {
    vi.useFakeTimers();
    win.androidBridge = {};
    const fixture = TestBed.createComponent(SplashOverlay);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-splash]')!.classList).toContain('pt-splash-held');

    vi.advanceTimersByTime(SPLASH_TOTAL_MS * 2);
    fixture.detectChanges();
    expect(el.querySelector('[data-splash]')).not.toBeNull();
  });

  it('plays on native once released and removes itself after the intro', async () => {
    vi.useFakeTimers();
    win.androidBridge = {};
    const fixture = TestBed.createComponent(SplashOverlay);
    fixture.detectChanges();
    await TestBed.inject(LaunchSplash).release();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-splash]').classList).not.toContain('pt-splash-held');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-splash]')).not.toBeNull();
    expect(el.textContent).toContain('Remember');
    const emblem = el.querySelector<HTMLElement>('[data-splash-emblem]')!;
    expect(emblem.style.width).toBe(`${emblemBox().size}px`);
    expect(emblem.style.getPropertyValue('--pt-splash-settle')).toContain('translateY(-45px)');

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
