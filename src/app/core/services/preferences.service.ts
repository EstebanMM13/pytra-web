import { Injectable, computed, signal } from '@angular/core';
import { Platform } from '../models/experience.model';

/** How finely ratings are typed in the run form: 9 / 9.5 / 9.25. */
export type RatingPrecision = 'integer' | 'half' | 'hundredths';

export interface Preferences {
  ratingPrecision: RatingPrecision;
  defaultPlatform: Platform;
}

export const PREFERENCES_KEY = 'pytra_preferences';

export const DEFAULT_PREFERENCES: Preferences = { ratingPrecision: 'hundredths', defaultPlatform: 'PC' };

const PRECISIONS: readonly RatingPrecision[] = ['integer', 'half', 'hundredths'];
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
  };
}

function readStored(): Preferences {
  try {
    return parsePreferences(localStorage.getItem(PREFERENCES_KEY));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Device-local UI preferences (rating precision, default platform for new runs). */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly state = signal<Preferences>(readStored());

  readonly ratingPrecision = computed(() => this.state().ratingPrecision);
  readonly defaultPlatform = computed(() => this.state().defaultPlatform);
  readonly ratingStep = computed(() => ratingStep(this.ratingPrecision()));

  setRatingPrecision(ratingPrecision: RatingPrecision): void {
    this.update({ ratingPrecision });
  }

  setDefaultPlatform(defaultPlatform: Platform): void {
    this.update({ defaultPlatform });
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
