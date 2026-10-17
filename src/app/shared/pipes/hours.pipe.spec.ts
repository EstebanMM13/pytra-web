import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { HoursPipe, formatHours } from './hours.pipe';

describe('HoursPipe', () => {
  let pipe: HoursPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslateService({ lang: 'es', fallbackLang: 'es' })] });
    pipe = TestBed.runInInjectionContext(() => new HoursPipe());
  });

  it('rounds to one decimal with a Spanish decimal comma', () => {
    expect(pipe.transform(112.91666666666667)).toBe('112,9 h');
  });

  it('drops the decimal part for whole hours', () => {
    expect(pipe.transform(6.8)).toBe('6,8 h');
    expect(pipe.transform(22)).toBe('22 h');
  });

  it('drops decimals for totals of 1000 h or more', () => {
    expect(pipe.transform(3748.7)).toBe(`${new Intl.NumberFormat('es-ES', { useGrouping: true }).format(3749)} h`);
  });

  it('treats missing values as zero', () => {
    expect(pipe.transform(null)).toBe('0 h');
    expect(pipe.transform(undefined)).toBe('0 h');
  });

  it('follows the UI language', () => {
    TestBed.inject(TranslateService).use('en');
    expect(pipe.transform(112.91666666666667)).toBe('112.9 h');
    expect(pipe.transform(3748.7)).toBe('3,749 h');
  });
});

describe('formatHours', () => {
  it('formats with the given locale', () => {
    expect(formatHours(6.8, 'es-ES')).toBe('6,8 h');
    expect(formatHours(6.8, 'en-US')).toBe('6.8 h');
  });
});
