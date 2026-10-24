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
    expect(parsePreferences(JSON.stringify({ ratingPrecision: 'half', defaultPlatform: 42 }))).toEqual({
      ratingPrecision: 'half',
      ratingScale: '10',
      defaultPlatform: 'PC',
      language: 'es',
      motion: 'system',
    });
    expect(parsePreferences(JSON.stringify({ ratingPrecision: 'x', defaultPlatform: 'SWITCH' }))).toEqual({
      ratingPrecision: 'hundredths',
      ratingScale: '10',
      defaultPlatform: 'SWITCH',
      language: 'es',
      motion: 'system',
    });
    expect(parsePreferences(JSON.stringify({ language: 'en' })).language).toBe('en');
    expect(parsePreferences(JSON.stringify({ language: 'fr' })).language).toBe('es');
    expect(parsePreferences(JSON.stringify({ motion: 'reduce' })).motion).toBe('reduce');
    expect(parsePreferences(JSON.stringify({ motion: 'fast' })).motion).toBe('system');
  });

  it('reads the rating scale, defaulting to 0–10 for missing or unknown values', () => {
    expect(parsePreferences(JSON.stringify({ ratingScale: '100' })).ratingScale).toBe('100');
    expect(parsePreferences(JSON.stringify({ ratingScale: '5' })).ratingScale).toBe('5');
    expect(parsePreferences(JSON.stringify({ ratingScale: 100 })).ratingScale).toBe('10');
    expect(parsePreferences(JSON.stringify({ ratingScale: '20' })).ratingScale).toBe('10');
    expect(parsePreferences(JSON.stringify({ ratingPrecision: 'half' })).ratingScale).toBe('10');
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
      ratingScale: '10',
      defaultPlatform: 'PS5',
      language: 'en',
      motion: 'system',
    });
  });

  it('stores the rating scale and exposes its max', () => {
    const service = TestBed.inject(PreferencesService);
    expect(service.ratingScale()).toBe('10');
    expect(service.ratingMax()).toBe(10);

    service.setRatingScale('100');
    expect(service.ratingMax()).toBe(100);
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).ratingScale).toBe('100');

    service.setRatingScale('5');
    expect(service.ratingMax()).toBe(5);
    expect(TestBed.runInInjectionContext(() => new PreferencesService()).ratingScale()).toBe('5');
  });

  it('stores the motion preference and mirrors it on <html data-motion>', () => {
    const service = TestBed.inject(PreferencesService);
    expect(service.motion()).toBe('system');

    service.setMotion('reduce');
    expect(document.documentElement.dataset['motion']).toBe('reduce');
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).motion).toBe('reduce');

    service.setMotion('full');
    expect(document.documentElement.dataset['motion']).toBe('full');

    service.setMotion('system');
    delete document.documentElement.dataset['motion'];
  });

  it('reads previously stored preferences', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ratingPrecision: 'integer', defaultPlatform: 'XBOX' }));
    const service = TestBed.inject(PreferencesService);
    expect(service.ratingPrecision()).toBe('integer');
    expect(service.defaultPlatform()).toBe('XBOX');
  });
});
