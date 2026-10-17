import { TestBed } from '@angular/core/testing';
import { PreferencesService } from '../../core/services/preferences.service';
import { RatingPipe } from './rating.pipe';

describe('RatingPipe', () => {
  let pipe: RatingPipe;
  let preferences: PreferencesService;

  beforeEach(() => {
    localStorage.clear();
    preferences = TestBed.inject(PreferencesService);
    pipe = TestBed.runInInjectionContext(() => new RatingPipe());
  });

  afterEach(() => localStorage.clear());

  it('uses the fixed decimals of the precision preference', () => {
    preferences.setRatingPrecision('hundredths');
    expect(pipe.transform(9.5)).toBe('9.50');
    preferences.setRatingPrecision('half');
    expect(pipe.transform(9.25)).toBe('9.3');
    preferences.setRatingPrecision('integer');
    expect(pipe.transform(9.25)).toBe('9');
  });

  it('renders missing values as an em dash', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
  });
});
