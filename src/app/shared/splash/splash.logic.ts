/**
 * In-app splash timeline (native cold start only). The native Android 12+ splash can only show a
 * centered icon on a flat background, so it stays minimal and hands over to this overlay, which
 * plays the brand intro and is gone after SPLASH_TOTAL_MS.
 */

/** Same deep brand purple as the native splash (android colors.xml `splash_background`). */
export const SPLASH_BACKGROUND = '#1e1833';

/** Whole intro, fade-out included: the overlay is removed (and stops taking taps) after this. */
export const SPLASH_TOTAL_MS = 1400;
export const SPLASH_FADE_OUT_MS = 300;
export const SPLASH_FADE_OUT_START_MS = SPLASH_TOTAL_MS - SPLASH_FADE_OUT_MS;

/**
 * Handoff geometry: the overlay's mark starts exactly where the native splash drew it
 * (android drawable/splash_icon.xml: mark viewBox scaled 1.15, its content box centred on the
 * screen), then settles up and shrinks to make room for the wordmark and slogan.
 */
export const NATIVE_MARK_SCALE = 1.15;
/** Centre of the mark's drawn content in its 100x100 viewBox (x 14-94, y 8-92). */
export const MARK_CONTENT_CENTER = { x: 54, y: 50 } as const;
/** Mark size once settled, in px. */
export const SETTLED_MARK_PX = 88;
/** How far the mark's centre rises above the screen centre once settled, in px. */
export const SETTLED_RISE_PX = 45;

export interface EmblemBox {
  /** Side of the emblem box at native size, px. */
  size: number;
  /** Offsets from the screen centre to the box's top-left corner, px. */
  left: number;
  top: number;
  /** transform-origin on the content centre, so the settle scales around it. */
  origin: string;
  settleScale: number;
  /** Offset from the screen centre to the top of the wordmark + slogan block, px. */
  textTop: number;
}

/** Space between the settled mark and the wordmark, px. */
const TEXT_GAP_PX = 20;

export function emblemBox(): EmblemBox {
  const size = 100 * NATIVE_MARK_SCALE;
  return {
    size,
    left: -MARK_CONTENT_CENTER.x * NATIVE_MARK_SCALE,
    top: -MARK_CONTENT_CENTER.y * NATIVE_MARK_SCALE,
    origin: `${MARK_CONTENT_CENTER.x}% ${MARK_CONTENT_CENTER.y}%`,
    settleScale: SETTLED_MARK_PX / size,
    textTop: -SETTLED_RISE_PX + SETTLED_MARK_PX / 2 + TEXT_GAP_PX,
  };
}

export const SLOGAN_WORDS = ['Play', 'Track', 'Remember'] as const;
const SLOGAN_START_MS = 620;
const SLOGAN_STEP_MS = 110;
/** Duration of each word's reveal. */
export const SLOGAN_WORD_MS = 240;

export interface SloganToken {
  text: string;
  /** Separator dot (shown with the word that follows it). */
  separator: boolean;
  delayMs: number;
}

/** Only inside the native shell, and never with reduced motion (the app shows at once). */
export function shouldShowSplash(native: boolean, reducedMotion: boolean): boolean {
  return native && !reducedMotion;
}

/** "Play · Track · Remember", revealed word by word; each dot arrives with the next word. */
export function sloganTokens(): SloganToken[] {
  return SLOGAN_WORDS.flatMap((word, index) => {
    const delayMs = SLOGAN_START_MS + index * SLOGAN_STEP_MS;
    const wordToken: SloganToken = { text: word, separator: false, delayMs };
    return index === 0 ? [wordToken] : [{ text: '·', separator: true, delayMs }, wordToken];
  });
}
