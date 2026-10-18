import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setMotionPreference } from '../utils/motion';
import {
  CoverTilt,
  MAX_TILT_DEG,
  PRESS_TILT_DEG,
  PRESSED_CLASS,
  pressTransform,
  tiltAngles,
  tiltTransform,
} from './cover-tilt';

describe('tiltAngles', () => {
  it('is flat at the centre', () => {
    expect(tiltAngles(50, 75, 100, 150)).toEqual({ rotateX: 0, rotateY: 0 });
  });

  it('reaches the max tilt at the edges, the edge under the pointer dipping away', () => {
    expect(tiltAngles(100, 75, 100, 150)).toEqual({ rotateX: 0, rotateY: MAX_TILT_DEG });
    expect(tiltAngles(0, 75, 100, 150)).toEqual({ rotateX: 0, rotateY: -MAX_TILT_DEG });
    expect(tiltAngles(50, 0, 100, 150)).toEqual({ rotateX: MAX_TILT_DEG, rotateY: 0 });
    expect(tiltAngles(50, 150, 100, 150)).toEqual({ rotateX: -MAX_TILT_DEG, rotateY: 0 });
  });

  it('clamps points outside the box and ignores empty boxes', () => {
    expect(tiltAngles(500, -40, 100, 150)).toEqual({ rotateX: MAX_TILT_DEG, rotateY: MAX_TILT_DEG });
    expect(tiltAngles(10, 10, 0, 0)).toEqual({ rotateX: 0, rotateY: 0 });
  });

  it('scales linearly in between', () => {
    expect(tiltAngles(75, 75, 100, 150)).toEqual({ rotateX: 0, rotateY: 3 });
  });

  it('builds a perspective transform', () => {
    expect(tiltTransform({ rotateX: 1.5, rotateY: -3 })).toBe('perspective(700px) rotateX(1.5deg) rotateY(-3deg)');
  });
});

@Component({
  imports: [CoverTilt],
  template: `<div appCoverTilt></div>`,
})
class Host {}

describe('CoverTilt', () => {
  const originalMatchMedia = globalThis.matchMedia;
  let frames: FrameRequestCallback[];

  function mockMedia(fineHover: boolean): void {
    globalThis.matchMedia = ((query: string) =>
      ({
        matches: query.includes('pointer: fine') ? fineHover : false,
        media: query,
        addEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof matchMedia;
  }

  function setup(): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[appCoverTilt]') as HTMLElement;
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 150 }) as DOMRect;
    // Drop frames the zoneless scheduler may have requested while rendering.
    frames.length = 0;
    return el;
  }

  function pointer(type: string, x: number, y: number, pointerType = 'mouse'): Event {
    const event = new MouseEvent(type, { clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    return event;
  }

  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    mockMedia(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.matchMedia = originalMatchMedia;
    setMotionPreference('system');
    delete document.documentElement.dataset['motion'];
  });

  it('writes at most one transform per frame, from the latest pointer position', () => {
    const el = setup();
    el.dispatchEvent(pointer('pointermove', 10, 10));
    el.dispatchEvent(pointer('pointermove', 100, 75));
    expect(frames).toHaveLength(1);

    frames[0](0);
    expect(el.style.transform).toBe(tiltTransform({ rotateX: 0, rotateY: MAX_TILT_DEG }));
  });

  it('resets to flat on leave', () => {
    const el = setup();
    el.dispatchEvent(pointer('pointermove', 100, 75));
    frames[0](0);
    el.dispatchEvent(pointer('pointerleave', 0, 0));
    expect(el.style.transform).toBe('');
  });

  it('stays flat for touch, coarse pointers and reduced motion', () => {
    const el = setup();
    el.dispatchEvent(pointer('pointermove', 100, 75, 'touch'));
    expect(frames).toHaveLength(0);

    mockMedia(false);
    el.dispatchEvent(pointer('pointermove', 100, 75));
    expect(frames).toHaveLength(0);

    mockMedia(true);
    setMotionPreference('reduce');
    el.dispatchEvent(pointer('pointermove', 100, 75));
    expect(frames).toHaveLength(0);
  });

  it('presses a touched cover: shrinks, tilts toward the touch point and sweeps the shine', () => {
    mockMedia(false);
    const el = setup();
    el.dispatchEvent(pointer('pointerdown', 100, 75, 'touch'));
    expect(el.style.transform).toBe(pressTransform({ rotateX: 0, rotateY: PRESS_TILT_DEG }));
    expect(el.classList).toContain(PRESSED_CLASS);

    el.dispatchEvent(pointer('pointerup', 100, 75, 'touch'));
    expect(el.style.transform).toBe('');
    expect(el.classList).not.toContain(PRESSED_CLASS);
  });

  it('springs back on cancel and when the page starts scrolling', () => {
    const el = setup();
    el.dispatchEvent(pointer('pointerdown', 50, 0, 'pen'));
    el.dispatchEvent(pointer('pointercancel', 50, 0, 'pen'));
    expect(el.classList).not.toContain(PRESSED_CLASS);

    el.dispatchEvent(pointer('pointerdown', 50, 0, 'touch'));
    window.dispatchEvent(new Event('scroll'));
    expect(el.style.transform).toBe('');
    expect(el.classList).not.toContain(PRESSED_CLASS);
  });

  it('never blocks the default action of a press', () => {
    const el = setup();
    const down = new MouseEvent('pointerdown', { clientX: 10, clientY: 10, cancelable: true });
    Object.defineProperty(down, 'pointerType', { value: 'touch' });
    el.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
  });

  it('does not press for the mouse or with reduced motion', () => {
    const el = setup();
    el.dispatchEvent(pointer('pointerdown', 100, 75, 'mouse'));
    expect(el.classList).not.toContain(PRESSED_CLASS);

    setMotionPreference('reduce');
    el.dispatchEvent(pointer('pointerdown', 100, 75, 'touch'));
    expect(el.style.transform).toBe('');
    expect(el.classList).not.toContain(PRESSED_CLASS);
  });
});
