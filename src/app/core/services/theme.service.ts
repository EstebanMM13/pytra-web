import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

const THEME_KEY = 'pytra_theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isPreference(stored) ? stored : 'dark';
  } catch {
    return 'dark';
  }
}

function systemPrefersLight(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia(LIGHT_QUERY).matches;
  } catch {
    return false;
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersLight() ? 'light' : 'dark';
  }
  return preference;
}

/** Browser/OS chrome colour per theme: matches `--pt-nav` so the status bar blends with the navbar. */
export const THEME_COLORS: Record<ResolvedTheme, string> = { dark: '#211f1c', light: '#ece6dc' };

function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset['theme'] = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

/**
 * Applies the stored theme synchronously. Called from main.ts before bootstrap so
 * the first paint already uses the right palette (no inline script needed: CSP
 * `script-src 'self'`).
 */
export function applyStoredTheme(): void {
  applyTheme(resolveTheme(readThemePreference()));
}

/** Dark / Light / System theme preference, persisted in localStorage. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly preferenceState = signal<ThemePreference>(readThemePreference());
  private readonly systemLight = signal(systemPrefersLight());

  readonly preference = this.preferenceState.asReadonly();
  readonly theme = computed<ResolvedTheme>(() => {
    const preference = this.preferenceState();
    if (preference === 'system') {
      return this.systemLight() ? 'light' : 'dark';
    }
    return preference;
  });

  constructor() {
    applyTheme(this.theme());
    this.listenToSystemChanges();
  }

  setPreference(preference: ThemePreference): void {
    this.preferenceState.set(preference);
    try {
      localStorage.setItem(THEME_KEY, preference);
    } catch {
      // Storage unavailable (private mode): the choice still applies for this session.
    }
    applyTheme(this.theme());
  }

  private listenToSystemChanges(): void {
    if (typeof matchMedia !== 'function') {
      return;
    }
    const query = matchMedia(LIGHT_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      this.systemLight.set(event.matches);
      applyTheme(this.theme());
    };
    query.addEventListener?.('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener?.('change', onChange));
  }
}
