import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PreferencesService } from '../../core/services/preferences.service';
import { ratingLocale } from '../utils/rating-format';
import { formatScaledRating } from '../utils/rating-scale';

/**
 * Formats a stored 0–10 rating on the user's rating scale (0–10, 0–100 or 0–5), with the decimals
 * of the precision preference and the decimal separator of the UI language (see
 * `formatScaledRating`). Impure so a preference or language change re-renders every rating on
 * screen. Pair with `font-mono`.
 */
@Pipe({ name: 'rating', pure: false })
export class RatingPipe implements PipeTransform {
  private readonly preferences = inject(PreferencesService);
  private readonly translate = inject(TranslateService);

  transform(value: number | null | undefined): string {
    return formatScaledRating(
      value,
      this.preferences.ratingScale(),
      this.preferences.ratingPrecision(),
      ratingLocale(this.translate.currentLang()),
    );
  }
}
