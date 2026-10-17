import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ScrollParallax, parallaxTransform } from './scroll-parallax';

describe('parallaxTransform', () => {
  it('starts at rest', () => {
    expect(parallaxTransform(0)).toBe('translate3d(0, 0px, 0) scale(1)');
  });

  it('drifts and grows proportionally across the range', () => {
    expect(parallaxTransform(160)).toBe('translate3d(0, 16px, 0) scale(1.06)');
    expect(parallaxTransform(320)).toBe('translate3d(0, 32px, 0) scale(1.12)');
  });

  it('holds past the range and ignores overscroll above the top', () => {
    expect(parallaxTransform(5000)).toBe('translate3d(0, 32px, 0) scale(1.12)');
    expect(parallaxTransform(-80)).toBe('translate3d(0, 0px, 0) scale(1)');
  });

  it('takes a custom scale and survives an empty range', () => {
    expect(parallaxTransform(320, 0.05)).toBe('translate3d(0, 32px, 0) scale(1.05)');
    expect(parallaxTransform(100, 0.12, 0)).toBe('translate3d(0, 0px, 0) scale(1)');
  });
});

@Component({
  imports: [ScrollParallax],
  template: `<div appScrollParallax data-backdrop></div>`,
})
class Host {}

describe('ScrollParallax', () => {
  const originalMatchMedia = globalThis.matchMedia;
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  let frames: FrameRequestCallback[];

  function mockMotion(reduce: boolean): void {
    globalThis.matchMedia = ((query: string) =>
      ({ matches: reduce && query === '(prefers-reduced-motion: reduce)', media: query }) as MediaQueryList) as typeof matchMedia;
  }

  beforeEach(() => {
    frames = [];
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => frames.push(cb)) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    globalThis.matchMedia = originalMatchMedia;
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancel;
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-backdrop]')!;
    return { fixture, el };
  }

  function scrollTo(y: number): void {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    window.dispatchEvent(new Event('scroll'));
  }

  it('follows the scroll with a passive listener, one write per frame, removed on destroy', () => {
    mockMotion(false);
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { fixture, el } = render();

    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
    expect(el.style.transformOrigin).toBe('center bottom');

    // Angular may queue frames of its own: count only those the scrolls add.
    const before = frames.length;
    scrollTo(160);
    scrollTo(320);
    expect(frames.length - before).toBe(1);
    frames.pop()!(0);
    expect(el.style.transform).toBe('translate3d(0, 32px, 0) scale(1.12)');

    const pending = frames.length;
    scrollTo(0);
    expect(frames.length - pending).toBe(1);
    fixture.destroy();
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('stays still with reduced motion', () => {
    mockMotion(true);
    const add = vi.spyOn(window, 'addEventListener');
    const { el } = render();
    expect(add).not.toHaveBeenCalledWith('scroll', expect.any(Function), expect.anything());
    expect(el.style.transform).toBe('');
  });
});
