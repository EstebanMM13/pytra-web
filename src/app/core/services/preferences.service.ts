import { Injectable, computed, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Platform } from '../models/experience.model';

/** How finely ratings are typed in the run form: 9 / 9.5 / 9.25. */
export type RatingPrecision = 'integer' | 'half' | 'hundredths';

/** UI language (ngx-translate). */
export type Language = 'es' | 'en';

export interface Preferences {
  ratingPrecision: RatingPrecision;
  defaultPlatform: Platform;
  language: Language;
}

export const PREFERENCES_KEY = 'pytra_preferences';

export const DEFAULT_PREFERENCES: Preferences = {
  ratingPrecision: 'hundredths',
  defaultPlatform: 'PC',
  language: 'es',
};

const PRECISIONS: readonly RatingPrecision[] = ['integer', 'half', 'hundredths'];
export const LANGUAGES: readonly Language[] = ['es', 'en'];
export const PLATFORMS: readonly Platform[] = ['PC', 'PS5', 'PS4', 'XBOX', 'SWITCH', 'MOBILE'];

/** Number input `step` for a rating precision. */
export function ratingStep(precision: RatingPrecision): number {
  return precision === 'integer' ? 1 : precision === 'half' ? 0.5 : 0.01;
}

/** Parses stored preferences, falling back to the defaults for anything missing or unknown. */
export function parsePreferences(raw: string | null): Preferences {
  let value: Partial<Record<keyof Preferences, unknown>> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      value = parsed as typeof value;
    }
  } catch {
    // Corrupted value: use the defaults.
  }
  return {
    ratingPrecision: PRECISIONS.includes(value.ratingPrecision as RatingPrecision)
      ? (value.ratingPrecision as RatingPrecision)
      : DEFAULT_PREFERENCES.ratingPrecision,
    defaultPlatform: PLATFORMS.includes(value.defaultPlatform as Platform)
      ? (value.defaultPlatform as Platform)
      : DEFAULT_PREFERENCES.defaultPlatform,
    language: LANGUAGES.includes(value.language as Language) ? (value.language as Language) : DEFAULT_PREFERENCES.language,
  };
}

function readStored(): Preferences {
  try {
    return parsePreferences(localStorage.getItem(PREFERENCES_KEY));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Applies the UI language: ngx-translate and `<html lang>`. */
export function applyLanguage(translate: TranslateService, language: Language): void {
  translate.use(language);
  try {
    document.documentElement.lang = language;
  } catch {
    // No DOM (unlikely): translations still switch.
  }
}

/** Device-local UI preferences (rating precision, default platform for new runs, language). */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly state = signal<Preferences>(readStored());

  readonly ratingPrecision = computed(() => this.state().ratingPrecision);
  readonly defaultPlatform = computed(() => this.state().defaultPlatform);
  readonly language = computed(() => this.state().language);
  readonly ratingStep = computed(() => ratingStep(this.ratingPrecision()));

  setRatingPrecision(ratingPrecision: RatingPrecision): void {
    this.update({ ratingPrecision });
  }

  setDefaultPlatform(defaultPlatform: Platform): void {
    this.update({ defaultPlatform });
  }

  setLanguage(language: Language): void {
    this.update({ language });
  }

  private update(change: Partial<Preferences>): void {
    this.state.update((current) => ({ ...current, ...change }));
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(this.state()));
    } catch {
      // Storage unavailable (private mode): the choice still applies for this session.
    }
  }
}
