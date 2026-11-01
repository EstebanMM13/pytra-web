import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ratingLocale } from '../utils/rating-format';

/** Whole-hour formatter per locale (totals of 100 h or more): the impure pipe formats on every change detection. */
const formatters = new Map<string, Intl.NumberFormat>();

function wholeHours(locale: string): Intl.NumberFormat {
  let formatter = formatters.get(locale);
  if (!formatter) {
    // Large totals drop the minutes so they fit in small cards (3.749 h, not 3748 h 42 min).
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: true });
    formatters.set(locale, formatter);
  }
  return formatter;
}

/**
 * Formats a decimal hour count as hours and minutes: 0.77 -> "46 min", 12.5 -> "12 h 30 min",
 * rounded to the nearest minute. From 100 h on only whole hours are shown, grouped in the locale
 * from 1000 h on ("3.749 h" es-ES / "3,749 h" en-US). Missing values read "0 h".
 */
export function formatHours(value: number | null | undefined, locale: string): string {
  const hours = value ?? 0;
  if (!Number.isFinite(hours) || hours === 0) {
    return '0 h';
  }
  if (hours < 0) {
    const positive = formatHours(-hours, locale);
    return positive === '0 h' ? positive : `-${positive}`;
  }
  const totalMinutes = Math.round(hours * 60);
  if (hours >= 100 || totalMinutes >= 100 * 60) {
    return `${wholeHours(locale).format(Math.round(hours))} h`;
  }
  const whole = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (whole === 0) {
    return minutes === 0 ? '0 h' : `${minutes} min`;
  }
  return minutes === 0 ? `${whole} h` : `${whole} h ${minutes} min`;
}

/**
 * A decimal hour count in a few characters for tiny cells (the diary calendar): 0.77 -> "46m",
 * 1 -> "1h", 1.5 -> "1h30". Minutes rounded like `formatHours`.
 */
export function compactHours(value: number | null | undefined): string {
  const total = Math.round((value ?? 0) * 60);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0 && minutes > 0) return `${minutes}m`;
  return minutes ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`;
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
