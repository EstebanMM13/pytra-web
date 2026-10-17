import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { UserService } from '../../core/services/user.service';
import { Navbar } from './navbar';

describe('Navbar', () => {
  function setup(demo = false) {
    const launcher = { openNewRun: vi.fn() };
    TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: AuthService, useValue: { isDemo: signal(demo), logout: vi.fn() } },
        { provide: RunFormLauncher, useValue: launcher },
        { provide: UserService, useValue: { displayName: signal('Ana'), currentUser: signal(null) } },
      ],
    });
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, launcher };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the slogan next to the phone wordmark, with brand initials, only from 360px', () => {
    const { el } = setup();
    const slogan = el.querySelector('header [data-slogan-mobile]')!;
    expect(slogan.textContent!.replace(/\s+/g, ' ').trim()).toBe('Play · Track · Remember');
    expect([...slogan.querySelectorAll('.text-brand-light')].map((s) => s.textContent)).toEqual(['P', 'T', 'R']);
    expect(slogan.classList).toContain('hidden');
    expect(slogan.classList).toContain('min-[360px]:inline');
    expect(slogan.getAttribute('aria-hidden')).toBe('true');
    // Search and avatar buttons stay.
    expect(el.querySelector('header button[aria-label="nav.search"]')).not.toBeNull();
    expect(el.querySelector('header button[aria-label="nav.menu"]')).not.toBeNull();
  });

  it('orders the mobile avatar menu: Profile, Steam, Log out', () => {
    const { fixture, el } = setup();
    el.querySelector<HTMLButtonElement>('button[aria-label="nav.menu"]')!.click();
    fixture.detectChanges();
    const items = [...el.querySelectorAll('header [role="menu"] [role="menuitem"]')].map((i) => i.textContent!.trim());
    expect(items).toEqual(['nav.profile', 'nav.steam', 'nav.logout']);
  });

  it('keeps the "+" entry points in the demo, and they open the run form', () => {
    const { fixture, el, launcher } = setup(true);
    const addButtons = el.querySelectorAll<HTMLButtonElement>('[data-add-menu] > button');
    // Web "+ Añadir" and the mobile tab bar "+".
    expect(addButtons).toHaveLength(2);
    addButtons[1].click();
    fixture.detectChanges();
    const runItem = [...el.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
      (b) => b.textContent!.trim() === 'nav.addRun',
    );
    runItem!.click();
    expect(launcher.openNewRun).toHaveBeenCalled();
  });
});
