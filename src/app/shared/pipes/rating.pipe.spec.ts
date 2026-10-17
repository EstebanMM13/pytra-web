import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { PreferencesService } from '../../core/services/preferences.service';
import { RatingPipe } from './rating.pipe';

describe('RatingPipe', () => {
  let pipe: RatingPipe;
  let preferences: PreferencesService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslateService({ lang: 'es', fallbackLang: 'es' })] });
    preferences = TestBed.inject(PreferencesService);
    pipe = TestBed.runInInjectionContext(() => new RatingPipe());
  });

  afterEach(() => localStorage.clear());

  it('uses the fixed decimals of the precision preference', () => {
    preferences.setRatingPrecision('hundredths');
    expect(pipe.transform(9.5)).toBe('9,50');
    preferences.setRatingPrecision('half');
    expect(pipe.transform(9.25)).toBe('9,3');
    preferences.setRatingPrecision('integer');
    expect(pipe.transform(9.25)).toBe('9');
  });

  it('uses the decimal separator of the UI language', () => {
    preferences.setRatingPrecision('hundredths');
    expect(pipe.transform(9.75)).toBe('9,75');
    TestBed.inject(TranslateService).use('en');
    expect(pipe.transform(9.75)).toBe('9.75');
  });

  it('renders missing values as an em dash', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
  });
});
