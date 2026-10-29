import { computed, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PreferencesService } from '../../core/services/preferences.service';
import { formatHours } from '../../shared/pipes/hours.pipe';
import { platformDisplayName } from '../../shared/ui/platform-label';
import { translatePlural } from '../../shared/utils/plural';
import { ratingLocale } from '../../shared/utils/rating-format';
import { formatScaledPoint, formatScaledRating } from '../../shared/utils/rating-scale';

/**
 * Formatters for row data built in TypeScript (bar lists), matching the hours / rating pipes:
 * UI language number format and the user's rating scale and precision. Call the returned
 * functions inside a `computed` so a language or preference change rebuilds the rows.
 * Created in an injection context.
 */
export function statsFormat() {
  const translate = inject(TranslateService);
  const preferences = inject(PreferencesService);
  /** UI language for the label tables keyed by language (month names). */
  const lang = computed(() => (translate.currentLang() === 'en' ? 'en' : 'es'));
  const locale = computed(() => ratingLocale(translate.currentLang()));
  return {
    lang,
    locale,
    hours: (value: number | null | undefined) => formatHours(value, locale()),
    rating: (value: number | null | undefined) =>
      formatScaledRating(value, preferences.ratingScale(), preferences.ratingPrecision(), locale()),
    /** A plain point of the rating scale for axis labels (10 -> "10", "100" or "5"). */
    point: (stored: number) => formatScaledPoint(stored, preferences.ratingScale(), translate.currentLang() ?? 'es'),
    plural: (key: string, count: number, params?: Record<string, unknown>) => {
      locale();
      return translatePlural(translate, key, count, params);
    },
    text: (key: string, params?: Record<string, unknown>) => {
      locale();
      return translate.instant(key, params) as string;
    },
    platform: (name: string) => {
      locale();
      return platformDisplayName(name, translate);
    },
  };
}
