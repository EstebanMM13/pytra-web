import { Pipe, PipeTransform } from '@angular/core';

const RATING_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: false,
});

/**
 * Formats a 0–10 rating for display, e.g. 9.25 -> "9.25", 8 -> "8".
 * Missing ratings render as an em dash. Pair with `font-mono text-gold`.
 */
@Pipe({ name: 'rating' })
export class RatingPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined || Number.isNaN(value)
      ? '—'
      : RATING_FORMAT.format(value);
  }
}
