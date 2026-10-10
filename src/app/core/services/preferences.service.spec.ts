import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  PreferencesService,
  parsePreferences,
  ratingStep,
} from './preferences.service';

describe('parsePreferences', () => {
  it('falls back to the defaults for missing or corrupted values', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('not json')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('"text"')).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps valid fields and replaces unknown ones', () => {
    expect(parsePreferences(JSON.stringify({ ratingPrecision: 'half', defaultPlatform: 'NES' }))).toEqual({
      ratingPrecision: 'half',
      defaultPlatform: 'PC',
      language: 'es',
    });
    expect(parsePreferences(JSON.stringify({ ratingPrecision: 'x', defaultPlatform: 'SWITCH' }))).toEqual({
      ratingPrecision: 'hundredths',
      defaultPlatform: 'SWITCH',
      language: 'es',
    });
    expect(parsePreferences(JSON.stringify({ language: 'en' })).language).toBe('en');
    expect(parsePreferences(JSON.stringify({ language: 'fr' })).language).toBe('es');
  });
});

describe('ratingStep', () => {
  it('maps each precision to an input step', () => {
    expect(ratingStep('integer')).toBe(1);
    expect(ratingStep('half')).toBe(0.5);
    expect(ratingStep('hundredths')).toBe(0.01);
  });
});

describe('PreferencesService', () => {
  beforeEach(() => localStorage.clear());

  it('starts from the defaults', () => {
    const service = TestBed.inject(PreferencesService);
    expect(service.ratingPrecision()).toBe('hundredths');
    expect(service.defaultPlatform()).toBe('PC');
    expect(service.ratingStep()).toBe(0.01);
    expect(service.language()).toBe('es');
  });

  it('persists changes in localStorage', () => {
    const service = TestBed.inject(PreferencesService);
    service.setRatingPrecision('half');
    service.setDefaultPlatform('PS5');
    service.setLanguage('en');

    expect(service.ratingStep()).toBe(0.5);
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!)).toEqual({
      ratingPrecision: 'half',
      defaultPlatform: 'PS5',
      language: 'en',
    });
  });

  it('reads previously stored preferences', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ratingPrecision: 'integer', defaultPlatform: 'XBOX' }));
    const service = TestBed.inject(PreferencesService);
    expect(service.ratingPrecision()).toBe('integer');
    expect(service.defaultPlatform()).toBe('XBOX');
  });
});
