import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { HoursPipe, compactHours, formatHours } from './hours.pipe';

describe('HoursPipe', () => {
  let pipe: HoursPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslateService({ lang: 'es', fallbackLang: 'es' })] });
    pipe = TestBed.runInInjectionContext(() => new HoursPipe());
  });

  it('reads as hours and minutes', () => {
    expect(pipe.transform(0.77)).toBe('46 min');
    expect(pipe.transform(12)).toBe('12 h');
    expect(pipe.transform(12.5)).toBe('12 h 30 min');
    expect(pipe.transform(1.99)).toBe('1 h 59 min');
  });

  it('rounds to the nearest minute', () => {
    // 0.9933 h = 59.6 min -> 60 min.
    expect(pipe.transform(59.6 / 60)).toBe('1 h');
    expect(pipe.transform(112.91666666666667 / 10)).toBe('11 h 18 min');
  });

  it('shows whole hours only from 100 h on', () => {
    expect(pipe.transform(152)).toBe('152 h');
    expect(pipe.transform(116.4)).toBe('116 h');
    expect(pipe.transform(99.999)).toBe('100 h');
  });

  it('groups totals of 1000 h or more', () => {
    expect(pipe.transform(3748.7)).toBe(`${new Intl.NumberFormat('es-ES', { useGrouping: true }).format(3749)} h`);
  });

  it('treats missing or zero values as zero', () => {
    expect(pipe.transform(null)).toBe('0 h');
    expect(pipe.transform(undefined)).toBe('0 h');
    expect(pipe.transform(0)).toBe('0 h');
  });

  it('follows the UI language', () => {
    TestBed.inject(TranslateService).use('en');
    expect(pipe.transform(12.5)).toBe('12 h 30 min');
    expect(pipe.transform(3748.7)).toBe('3,749 h');
  });
});

describe('formatHours', () => {
  it('formats with the given locale', () => {
    expect(formatHours(6.8, 'es-ES')).toBe('6 h 48 min');
    expect(formatHours(1234.4, 'en-US')).toBe('1,234 h');
  });
});

describe('compactHours', () => {
  it('reads hours and minutes in a few characters for tiny cells', () => {
    expect(compactHours(0.77)).toBe('46m');
    expect(compactHours(1)).toBe('1h');
    expect(compactHours(1.5)).toBe('1h30');
    expect(compactHours(2.05)).toBe('2h03');
    expect(compactHours(0)).toBe('0h');
  });
});
