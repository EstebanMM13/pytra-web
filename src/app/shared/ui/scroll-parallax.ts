import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input, numberAttribute } from '@angular/core';
import { canAnimate } from '../utils/motion';

/** Scroll distance (px) over which the effect runs to its end. */
export const PARALLAX_RANGE = 320;
/** Downward drift (px) at the end of the range: the backdrop scrolls slower than the page. */
export const PARALLAX_SHIFT = 32;

/**
 * Transform for a hero backdrop after `scrollY` px of page scroll: drifts down by up to `shift` px
 * and grows by up to `scale` (12% by default) across `range` px, then holds. Rounded to keep the
 * style writes stable.
 */
export function parallaxTransform(scrollY: number, scale = 0.12, range = PARALLAX_RANGE, shift = PARALLAX_SHIFT): string {
  const progress = range > 0 ? Math.min(1, Math.max(0, scrollY / range)) : 0;
  const y = Math.round(progress * shift * 10) / 10;
  const s = Math.round((1 + progress * scale) * 1000) / 1000;
  return `translate3d(0, ${y}px, 0) scale(${s})`;
}

/**
 * Subtle scroll parallax for a decorative backdrop: a passive window scroll listener, throttled to
 * one transform write per animation frame, removed on destroy. Transform only (the element grows
 * from its bottom edge so the drift never uncovers its top); nothing runs with reduced motion or
 * without `requestAnimationFrame` (tests, SSR).
 */
@Directive({ selector: '[appScrollParallax]' })
export class ScrollParallax {
  /** Extra scale reached at the end of the range (0.12 = 12%). */
  readonly parallaxScale = input(0.12, { transform: numberAttribute });

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!canAnimate() || typeof window === 'undefined') return;
      let frame = 0;
      const apply = () => {
        frame = 0;
        el.style.transform = parallaxTransform(window.scrollY, this.parallaxScale());
      };
      const onScroll = () => {
        if (!frame) frame = requestAnimationFrame(apply);
      };
      el.style.transformOrigin = 'center bottom';
      el.style.willChange = 'transform';
      apply();
      window.addEventListener('scroll', onScroll, { passive: true });
      destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onScroll);
        if (frame) cancelAnimationFrame(frame);
      });
    });
  }
}
