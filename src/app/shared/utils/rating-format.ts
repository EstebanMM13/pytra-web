import type { RatingPrecision } from '../../core/services/preferences.service';

/** Decimals every rating is shown with for a precision preference: 9 / 9.5 / 9.25 -> 0 / 1 / 2. */
export function ratingDecimals(precision: RatingPrecision): 0 | 1 | 2 {
  return precision === 'integer' ? 0 : precision === 'half' ? 1 : 2;
}

/** Rounds half up at `decimals` places, avoiding binary drift (9.995 -> 10.00, not 9.99). */
function roundHalfUp(value: number, decimals: number): number {
  const shifted = Number(`${value}e${decimals}`);
  return Number.isFinite(shifted)
    ? Number(`${Math.round(shifted)}e-${decimals}`)
    : Math.round(value * 10 ** decimals) / 10 ** decimals;
}

/** Display locale of a UI language, the same mapping dates and numbers use elsewhere ("en" -> en-US, else es-ES). */
export function ratingLocale(lang: string | null | undefined): string {
  return lang === 'en' ? 'en-US' : 'es-ES';
}

/** One formatter per locale and decimals: the impure rating pipe formats on every change detection. */
const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(locale: string, decimals: number): Intl.NumberFormat {
  const key = `${locale}|${decimals}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: false,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * The single display format for a 0–10 rating: a fixed number of decimals with the locale's
 * decimal separator, e.g. 9.5 -> "9,50" (es-ES) / "9.50" (en-US) with 2, 9.25 -> "9,3" with 1,
 * 9.5 -> "10" with 0. Missing values -> "—".
 */
export function formatRating(value: number | null | undefined, decimals: number, locale = 'es-ES'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  // Rounded here (half up, drift-free) so the formatter only lays out the digits.
  return formatterFor(locale, decimals).format(roundHalfUp(value, decimals));
}
