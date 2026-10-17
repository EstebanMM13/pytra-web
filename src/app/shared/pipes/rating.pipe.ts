import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PreferencesService } from '../../core/services/preferences.service';
import { formatRating, ratingDecimals, ratingLocale } from '../utils/rating-format';

/**
 * Formats a 0–10 rating with the decimals of the user's precision preference and the decimal
 * separator of the UI language (see `formatRating`). Impure so a preference or language change
 * re-renders every rating on screen. Pair with `font-mono`.
 */
@Pipe({ name: 'rating', pure: false })
export class RatingPipe implements PipeTransform {
  private readonly preferences = inject(PreferencesService);
  private readonly translate = inject(TranslateService);

  transform(value: number | null | undefined): string {
    return formatRating(
      value,
      ratingDecimals(this.preferences.ratingPrecision()),
      ratingLocale(this.translate.currentLang()),
    );
  }
}
