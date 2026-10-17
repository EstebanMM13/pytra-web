import { inject, Pipe, PipeTransform } from '@angular/core';
import { PreferencesService } from '../../core/services/preferences.service';
import { formatRating, ratingDecimals } from '../utils/rating-format';

/**
 * Formats a 0–10 rating with the decimals of the user's precision preference (see `formatRating`).
 * Impure so a preference change re-renders every rating on screen. Pair with `font-mono`.
 */
@Pipe({ name: 'rating', pure: false })
export class RatingPipe implements PipeTransform {
  private readonly preferences = inject(PreferencesService);

  transform(value: number | null | undefined): string {
    return formatRating(value, ratingDecimals(this.preferences.ratingPrecision()));
  }
}
