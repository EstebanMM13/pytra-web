import { TestBed } from '@angular/core/testing';
import { ThemeService, applyStoredTheme, readThemePreference } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  it('defaults to dark when nothing is stored', () => {
    expect(readThemePreference()).toBe('dark');
    applyStoredTheme();
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('ignores unknown stored values', () => {
    localStorage.setItem('pytra_theme', 'neon');
    expect(readThemePreference()).toBe('dark');
  });

  it('persists the preference and applies it to <html>', () => {
    const service = TestBed.inject(ThemeService);
    service.setPreference('light');

    expect(service.preference()).toBe('light');
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem('pytra_theme')).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('resolves "system" to a concrete theme', () => {
    const service = TestBed.inject(ThemeService);
    service.setPreference('system');

    expect(['dark', 'light']).toContain(service.theme());
    expect(document.documentElement.dataset['theme']).toBe(service.theme());
  });
});
