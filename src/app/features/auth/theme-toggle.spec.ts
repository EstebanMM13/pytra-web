import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ResolvedTheme, ThemePreference, ThemeService } from '../../core/services/theme.service';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  function setup(preference: ThemePreference, systemTheme: ResolvedTheme = 'dark') {
    const pref = signal(preference);
    const theme = computed<ResolvedTheme>(() => (pref() === 'system' ? systemTheme : (pref() as ResolvedTheme)));
    const setPreference = vi.fn((next: ThemePreference) => pref.set(next));
    TestBed.configureTestingModule({
      imports: [ThemeToggle],
      providers: [provideTranslateService(), { provide: ThemeService, useValue: { theme, setPreference } }],
    });
    const fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
    const button = (): HTMLButtonElement => fixture.nativeElement.querySelector('button');
    const iconClass = () => button().querySelector('svg')?.getAttribute('class') ?? '';
    return { fixture, button, iconClass, setPreference };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('offers dark mode with a moon while the light theme is active', () => {
    const { button, iconClass } = setup('light');
    expect(button().getAttribute('aria-label')).toBe('theme.switchToDark');
    expect(button().getAttribute('title')).toBe('theme.switchToDark');
    expect(iconClass()).toContain('moon');
  });

  it('offers light mode with a sun while the dark theme is active', () => {
    const { button, iconClass } = setup('dark');
    expect(button().getAttribute('aria-label')).toBe('theme.switchToLight');
    expect(iconClass()).toContain('sun');
  });

  it('flips the theme and updates its icon and label', async () => {
    const { fixture, button, iconClass, setPreference } = setup('dark');
    button().click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(setPreference).toHaveBeenCalledWith('light');
    expect(button().getAttribute('aria-label')).toBe('theme.switchToDark');
    expect(iconClass()).toContain('moon');
  });

  it('switches from a system preference to the opposite of the effective theme', () => {
    const { button, setPreference } = setup('system', 'light');
    expect(button().getAttribute('aria-label')).toBe('theme.switchToDark');
    button().click();
    expect(setPreference).toHaveBeenCalledWith('dark');
  });
});
