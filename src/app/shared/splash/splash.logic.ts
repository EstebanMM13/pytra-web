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
