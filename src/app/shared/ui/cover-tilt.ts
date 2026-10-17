import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { canAnimate } from '../utils/motion';

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

const FINE_HOVER_QUERY = '(hover: hover) and (pointer: fine)';

/**
 * Subtle 3D tilt that follows the mouse over a cover (desktop only: fine pointer with hover, and
 * not with reduced motion). One style write per animation frame, back to flat on leave. Native
 * listeners, so pointer moves never trigger change detection. Uses `transform`, so it composes
 * with the `translate` / `scale` hover lift.
 */
@Directive({
  selector: '[appCoverTilt]',
  host: { class: 'cover-tilt' },
})
export class CoverTilt {
  private readonly el: HTMLElement = inject(ElementRef).nativeElement;
  private frame = 0;
  private pointer = { x: 0, y: 0 };

  constructor() {
    const move = (event: PointerEvent): void => this.onMove(event);
    const leave = (): void => this.reset();
    this.el.addEventListener('pointermove', move);
    this.el.addEventListener('pointerleave', leave);
    inject(DestroyRef).onDestroy(() => {
      this.el.removeEventListener('pointermove', move);
      this.el.removeEventListener('pointerleave', leave);
      this.cancelFrame();
    });
  }

  private enabled(): boolean {
    return canAnimate() && matchMedia(FINE_HOVER_QUERY).matches;
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

  private reset(): void {
    this.cancelFrame();
    this.el.style.transform = '';
  }

  private cancelFrame(): void {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }
}
