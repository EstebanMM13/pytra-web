import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { canAnimate } from '../utils/motion';
import { mediaQuery } from '../utils/media-query';

/** Strongest tilt, in degrees, at the cover's edges. */
export const MAX_TILT_DEG = 6;

export interface TiltAngles {
  rotateX: number;
  rotateY: number;
}

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);
const round2 = (value: number): number => Math.round(value * 100) / 100 || 0;

/**
 * Tilt for a pointer at (x, y) inside a w x h box: the edge under the pointer dips away, up to
 * `max` degrees at the borders and flat at the centre. Points outside the box are clamped.
 */
export function tiltAngles(x: number, y: number, width: number, height: number, max = MAX_TILT_DEG): TiltAngles {
  if (width <= 0 || height <= 0) {
    return { rotateX: 0, rotateY: 0 };
  }
  const px = clamp01(x / width) - 0.5;
  const py = clamp01(y / height) - 0.5;
  return { rotateX: round2(-py * 2 * max), rotateY: round2(px * 2 * max) };
}

export function tiltTransform({ rotateX, rotateY }: TiltAngles): string {
  return `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
}

/** Tilt of a touch / pen press, in degrees at the edges: gentler than the mouse tilt. */
export const PRESS_TILT_DEG = 4;

/** Scale of a pressed cover. */
export const PRESS_SCALE = 0.96;

/** Pressed cover: tilted toward the touch point and slightly shrunk. */
export function pressTransform(angles: TiltAngles): string {
  return `${tiltTransform(angles)} scale(${PRESS_SCALE})`;
}

/** Class set while a touch / pen press holds the cover: drives the shine sweep (games.css). */
export const PRESSED_CLASS = 'cover-pressed';

const FINE_HOVER_QUERY = '(hover: hover) and (pointer: fine)';

/**
 * Subtle 3D tilt that follows the mouse over a cover (desktop only: fine pointer with hover, and
 * not with reduced motion). One style write per animation frame, back to flat on leave. Native
 * listeners, so pointer moves never trigger change detection. Uses `transform`, so it composes
 * with the `translate` / `scale` hover lift.
 *
 * Touch and pen get press feedback instead: on pointerdown the cover shrinks a little, tilts toward
 * the touch point and gets `cover-pressed` (a shine sweep); it springs back on pointerup / cancel /
 * leave and as soon as the page scrolls. Listeners are passive and never call preventDefault, so
 * scrolling and the tap's navigation are untouched. Nothing moves with reduced motion.
 */
@Directive({
  selector: '[appCoverTilt]',
  host: { class: 'cover-tilt' },
})
export class CoverTilt {
  private readonly el: HTMLElement = inject(ElementRef).nativeElement;
  private frame = 0;
  private pointer = { x: 0, y: 0 };

  private readonly release = (): void => this.endPress();
  private pressed = false;

  constructor() {
    const move = (event: PointerEvent): void => this.onMove(event);
    const leave = (): void => this.reset();
    const down = (event: PointerEvent): void => this.onDown(event);
    const passive = { passive: true };
    this.el.addEventListener('pointermove', move, passive);
    this.el.addEventListener('pointerleave', leave, passive);
    this.el.addEventListener('pointerdown', down, passive);
    this.el.addEventListener('pointerup', this.release, passive);
    this.el.addEventListener('pointercancel', this.release, passive);
    inject(DestroyRef).onDestroy(() => {
      this.el.removeEventListener('pointermove', move);
      this.el.removeEventListener('pointerleave', leave);
      this.el.removeEventListener('pointerdown', down);
      this.el.removeEventListener('pointerup', this.release);
      this.el.removeEventListener('pointercancel', this.release);
      this.endPress();
      this.cancelFrame();
    });
  }

  private enabled(): boolean {
    // Shared MediaQueryLists (motion + fine hover): read per pointermove, created once.
    return canAnimate() && (mediaQuery(FINE_HOVER_QUERY)?.matches ?? false);
  }

  private onMove(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || !this.enabled()) {
      return;
    }
    this.pointer = { x: event.clientX, y: event.clientY };
    if (this.frame) {
      return;
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const rect = this.el.getBoundingClientRect();
      const angles = tiltAngles(this.pointer.x - rect.left, this.pointer.y - rect.top, rect.width, rect.height);
      this.el.style.transform = tiltTransform(angles);
    });
  }

  private onDown(event: PointerEvent): void {
    if ((event.pointerType !== 'touch' && event.pointerType !== 'pen') || !canAnimate()) {
      return;
    }
    const rect = this.el.getBoundingClientRect();
    const angles = tiltAngles(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
      PRESS_TILT_DEG,
    );
    this.el.style.transform = pressTransform(angles);
    this.el.classList.add(PRESSED_CLASS);
    if (!this.pressed) {
      this.pressed = true;
      // A scroll starting under the finger springs the cover back (capture: any scroll container).
      window.addEventListener('scroll', this.release, { capture: true, passive: true });
    }
  }

  private endPress(): void {
    if (!this.pressed) {
      return;
    }
    this.pressed = false;
    window.removeEventListener('scroll', this.release, { capture: true });
    this.el.classList.remove(PRESSED_CLASS);
    this.el.style.transform = '';
  }

  private reset(): void {
    this.cancelFrame();
    this.endPress();
    this.el.style.transform = '';
  }

  private cancelFrame(): void {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }
}
