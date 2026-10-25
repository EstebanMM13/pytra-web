import { Injectable, computed, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MOTION_PREFERENCES, MotionPreference, setMotionPreference } from '../../shared/utils/motion';
import { RATING_SCALES, RatingScale, ratingScaleMax } from '../../shared/utils/rating-scale-options';

/** How finely ratings are typed in the run form: 9 / 9.5 / 9.25. */
export type RatingPrecision = 'integer' | 'half' | 'hundredths';

/** UI language (ngx-translate). */
export type Language = 'es' | 'en';

export interface Preferences {
  ratingPrecision: RatingPrecision;
  /** Scale ratings are shown and typed on (stored on 0–10 regardless; see shared/utils/rating-scale.ts). */
  ratingScale: RatingScale;
  /**
   * Platform preselected for new runs: a catalog id ("14"), or an old enum value ("PC") saved before
   * the catalog existed. Resolved against the catalog with `findPlatformByKey`.
   */
  defaultPlatform: string;
  language: Language;
  /** Animations: follow the OS, always on, or reduced (see shared/utils/motion.ts). */
  motion: MotionPreference;
  /** Daily diary reminder of the Android app (local notification), off by default. */
  diaryReminder: boolean;
  /** Its local time, `HH:MM` (24 h). */
  diaryReminderTime: string;
}

export const PREFERENCES_KEY = 'pytra_preferences';

export const DEFAULT_PREFERENCES: Preferences = {
  ratingPrecision: 'hundredths',
  ratingScale: '10',
  defaultPlatform: 'PC',
  language: 'es',
  motion: 'system',
  diaryReminder: false,
  diaryReminderTime: '22:00',
};

const PRECISIONS: readonly RatingPrecision[] = ['integer', 'half', 'hundredths'];
export const LANGUAGES: readonly Language[] = ['es', 'en'];
const MAX_PLATFORM_KEY_LENGTH = 40;
const REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isPlatformKey(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_PLATFORM_KEY_LENGTH;
}

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
    ratingScale: RATING_SCALES.includes(value.ratingScale as RatingScale)
      ? (value.ratingScale as RatingScale)
      : DEFAULT_PREFERENCES.ratingScale,
    defaultPlatform: isPlatformKey(value.defaultPlatform) ? value.defaultPlatform : DEFAULT_PREFERENCES.defaultPlatform,
    language: LANGUAGES.includes(value.language as Language) ? (value.language as Language) : DEFAULT_PREFERENCES.language,
    motion: MOTION_PREFERENCES.includes(value.motion as MotionPreference)
      ? (value.motion as MotionPreference)
      : DEFAULT_PREFERENCES.motion,
    diaryReminder: value.diaryReminder === true,
    diaryReminderTime:
      typeof value.diaryReminderTime === 'string' && REMINDER_TIME_PATTERN.test(value.diaryReminderTime)
        ? value.diaryReminderTime
        : DEFAULT_PREFERENCES.diaryReminderTime,
  };
}

function readStored(): Preferences {
  try {
    return parsePreferences(localStorage.getItem(PREFERENCES_KEY));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Applies the stored motion preference to `<html data-motion>` and the JS gates. Called from
 * main.ts before bootstrap so the first frame already honours it.
 */
export function applyStoredMotion(): void {
  setMotionPreference(readStored().motion);
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

/**
 * Device-local UI preferences (rating precision and scale, default platform for new runs, language, motion,
 * the Android diary reminder).
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly state = signal<Preferences>(readStored());

  readonly ratingPrecision = computed(() => this.state().ratingPrecision);
  readonly ratingScale = computed(() => this.state().ratingScale);
  /** Upper bound of the rating scale (10, 100 or 5), for "/ 10" style labels. */
  readonly ratingMax = computed(() => ratingScaleMax(this.ratingScale()));
  readonly defaultPlatform = computed(() => this.state().defaultPlatform);
  readonly language = computed(() => this.state().language);
  readonly motion = computed(() => this.state().motion);
  readonly ratingStep = computed(() => ratingStep(this.ratingPrecision()));
  readonly diaryReminder = computed(() => this.state().diaryReminder);
  readonly diaryReminderTime = computed(() => this.state().diaryReminderTime);

  setRatingPrecision(ratingPrecision: RatingPrecision): void {
    this.update({ ratingPrecision });
  }

  setRatingScale(ratingScale: RatingScale): void {
    this.update({ ratingScale });
  }

  setDefaultPlatform(defaultPlatform: string): void {
    this.update({ defaultPlatform });
  }

  setLanguage(language: Language): void {
    this.update({ language });
  }

  setMotion(motion: MotionPreference): void {
    this.update({ motion });
    setMotionPreference(motion);
  }

  /** Stores the diary reminder choice (scheduling it is DiaryReminderService's job). */
  setDiaryReminder(diaryReminder: boolean, diaryReminderTime: string = this.diaryReminderTime()): void {
    this.update({ diaryReminder, diaryReminderTime });
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
