/**
 * Motion preference: `system` follows the OS (`prefers-reduced-motion`), `full` animates even when
 * the OS asks to reduce, `reduce` turns effects off. Stored with the other local preferences.
 */
export type MotionPreference = 'system' | 'full' | 'reduce';

/** Effective motion mode, mirrored on `<html data-motion>` for the CSS gates (src/motion.css). */
export type MotionMode = 'full' | 'reduce';

export const MOTION_PREFERENCES: readonly MotionPreference[] = ['system', 'full', 'reduce'];

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

let preference: MotionPreference = 'system';
let osListenerAttached = false;

/** Whether the OS asks to minimise motion. False where `matchMedia` is missing (jsdom, SSR). */
function osPrefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia(REDUCE_QUERY).matches;
  } catch {
    return false;
  }
}

/** The effective mode for a preference: an explicit choice wins, `system` follows the OS. */
export function resolveMotion(pref: MotionPreference, osReduces: boolean): MotionMode {
  if (pref === 'system') {
    return osReduces ? 'reduce' : 'full';
  }
  return pref;
}

/** The current in-app motion preference (set from PreferencesService / main.ts). */
export function motionPreference(): MotionPreference {
  return preference;
}

/** Writes the effective mode on `<html data-motion>` so every CSS gate follows it. */
function applyMotionAttribute(): void {
  try {
    document.documentElement.dataset['motion'] = resolveMotion(preference, osPrefersReducedMotion());
  } catch {
    // No DOM: the JS gates below still read the preference.
  }
}

/**
 * Sets the motion preference and reflects it on `<html>`. The first call also follows OS changes
 * (only visible while the preference is `system`).
 */
export function setMotionPreference(pref: MotionPreference): void {
  preference = pref;
  applyMotionAttribute();
  if (!osListenerAttached && typeof matchMedia === 'function') {
    try {
      matchMedia(REDUCE_QUERY).addEventListener?.('change', applyMotionAttribute);
      osListenerAttached = true;
    } catch {
      // Old engines without MediaQueryList events: the OS state is read on each call instead.
    }
  }
}

/**
 * Whether motion should be minimised: the in-app preference first (`reduce` / `full`), then the
 * OS setting. False where `matchMedia` is missing (jsdom, SSR), which never animates anyway (see
 * `canAnimate`).
 */
export function prefersReducedMotion(): boolean {
  return resolveMotion(preference, osPrefersReducedMotion()) === 'reduce';
}

/**
 * Whether a script-driven animation (count-up, parallax, tilt, confetti, splash) should run. It
 * needs `requestAnimationFrame` and `matchMedia`; without them (tests, SSR) or with reduced motion
 * the final state renders at once.
 */
export function canAnimate(): boolean {
  return typeof requestAnimationFrame === 'function' && typeof matchMedia === 'function' && !prefersReducedMotion();
}
