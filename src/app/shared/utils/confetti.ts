import { ExperienceStatus } from '../../core/models/experience.model';
import { canAnimate } from './motion';

/** The part of a run that decides whether a save deserves a celebration. */
export interface CelebratedRun {
  status: ExperienceStatus;
  platinum: boolean;
}

/**
 * Confetti after a successful save that *reaches* a milestone: the run becomes COMPLETADO or gains
 * its platinum (a new run, or an edit that changes it). Re-saving an already completed / platinum
 * run stays quiet, and the read-only demo never celebrates.
 */
export function shouldCelebrate(saved: CelebratedRun, previous: CelebratedRun | null, demo: boolean): boolean {
  if (demo) {
    return false;
  }
  const completedNow = saved.status === 'COMPLETADO' && previous?.status !== 'COMPLETADO';
  const platinumNow = saved.platinum && !previous?.platinum;
  return completedNow || platinumNow;
}

export interface ConfettiParticle {
  /** Peak offset (px) from the origin, then the fall below it. */
  dx: number;
  rise: number;
  fall: number;
  rotate: number;
  size: number;
  color: string;
  delayMs: number;
  durationMs: number;
}

export const CONFETTI_COUNT = 20;
/** Brand purple, lavender, gold and a warm white. */
const CONFETTI_COLORS = ['#724dce', '#9d7cff', '#e2ae5f', '#f7f3ea'] as const;
const MAX_DELAY_MS = 120;
const MIN_DURATION_MS = 900;
const MAX_DURATION_MS = 1300;

/** Particle spread for one burst; `random` is injectable for tests. */
export function confettiParticles(count = CONFETTI_COUNT, random: () => number = Math.random): ConfettiParticle[] {
  return Array.from({ length: count }, (_, i) => {
    // Fan out evenly left to right, jittered so the burst never looks gridded.
    const spread = (i / Math.max(count - 1, 1)) * 2 - 1;
    return {
      dx: Math.round(spread * 160 + (random() - 0.5) * 40),
      rise: Math.round(90 + random() * 90),
      fall: Math.round(120 + random() * 140),
      rotate: Math.round((random() - 0.5) * 720),
      size: 6 + Math.round(random() * 3),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delayMs: Math.round(random() * MAX_DELAY_MS),
      durationMs: Math.round(MIN_DURATION_MS + random() * (MAX_DURATION_MS - MIN_DURATION_MS)),
    };
  });
}

/** Longest a burst can live: its container is removed after this. */
export const CONFETTI_LIFETIME_MS = MAX_DELAY_MS + MAX_DURATION_MS + 100;

/**
 * Small DOM confetti burst from the upper middle of the viewport (transform / opacity only, Web
 * Animations). Purely decorative: aria-hidden, takes no clicks, removed by itself. Does nothing
 * with reduced motion (OS or the in-app preference) or without the Web Animations API.
 */
export function burstConfetti(doc: Document = document): void {
  if (!canAnimate() || typeof doc.body?.animate !== 'function') {
    return;
  }
  const layer = doc.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.dataset['confetti'] = '';
  layer.style.cssText = 'position:fixed;left:50%;top:38%;width:0;height:0;z-index:1100;pointer-events:none';

  for (const p of confettiParticles()) {
    const piece = doc.createElement('span');
    piece.style.cssText =
      `position:absolute;left:0;top:0;width:${p.size}px;height:${Math.round(p.size * 0.45)}px;` +
      `border-radius:1px;background:${p.color};opacity:0`;
    layer.appendChild(piece);
    piece.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${p.dx * 0.7}px, ${-p.rise}px) rotate(${p.rotate * 0.5}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${p.dx}px, ${p.fall}px) rotate(${p.rotate}deg)`, opacity: 0 },
      ],
      { duration: p.durationMs, delay: p.delayMs, easing: 'cubic-bezier(0.25, 0.6, 0.4, 1)', fill: 'backwards' },
    );
  }

  doc.body.appendChild(layer);
  setTimeout(() => layer.remove(), CONFETTI_LIFETIME_MS);
}
