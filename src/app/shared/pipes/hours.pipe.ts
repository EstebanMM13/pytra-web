import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ratingLocale } from '../utils/rating-format';

/** Two formatters per locale (regular and large totals): the impure pipe formats on every change detection. */
const formatters = new Map<string, { regular: Intl.NumberFormat; large: Intl.NumberFormat }>();

function formattersFor(locale: string): { regular: Intl.NumberFormat; large: Intl.NumberFormat } {
  let entry = formatters.get(locale);
  if (!entry) {
    entry = {
      regular: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
      // Large totals drop the decimal so they fit in small cards (3.749 h, not 3748,7 h).
      large: new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: true }),
    };
    formatters.set(locale, entry);
  }
  return entry;
}

/** Formats a decimal hour count in a locale, e.g. 112.916666 -> "112,9 h" (es-ES) / "112.9 h" (en-US). */
export function formatHours(value: number | null | undefined, locale: string): string {
  const hours = value ?? 0;
  const { regular, large } = formattersFor(locale);
  return `${(hours >= 1000 ? large : regular).format(hours)} h`;
}

/**
 * Formats a decimal hour count with the number format of the UI language (see `formatHours`).
 * Impure so a language change re-renders every hour count on screen, like the rating pipe.
 */
@Pipe({ name: 'hours', pure: false })
export class HoursPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(value: number | null | undefined): string {
    return formatHours(value, ratingLocale(this.translate.currentLang()));
  }
}
