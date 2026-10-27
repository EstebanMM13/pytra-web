import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { UserService } from '../../core/services/user.service';
import { Navbar, isTabActive } from './navbar';

@Component({ template: '' })
class Blank {}

describe('Navbar', () => {
  function setup(demo = false) {
    const launcher = { openNewRun: vi.fn() };
    TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([{ path: '**', component: Blank }]),
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

  it('shows the slogan next to the phone wordmark, with emphasised initials, only from 360px', () => {
    const { el } = setup();
    const slogan = el.querySelector('header [data-slogan-mobile]')!;
    expect(slogan.textContent!.replace(/\s+/g, ' ').trim()).toBe('Play · Track · Remember');
    expect([...slogan.querySelectorAll('.font-semibold')].map((s) => s.textContent)).toEqual(['P', 'T', 'R']);
    // Initials in the brand purple, the rest of each word in the text colour, the dots muted.
    expect([...slogan.querySelectorAll('.text-brand-light')].map((s) => s.textContent)).toEqual(['P', 'T', 'R']);
    expect([...slogan.querySelectorAll(':scope > .text-text')].map((s) => s.textContent)).toEqual([
      'Play',
      'Track',
      'Remember',
    ]);
    expect(slogan.classList).toContain('text-text-3');
    expect(slogan.classList).toContain('hidden');
    expect(slogan.classList).toContain('min-[360px]:inline');
    expect(slogan.getAttribute('aria-hidden')).toBe('true');
    // Search and avatar buttons stay.
    expect(el.querySelector('header button[aria-label="nav.search"]')).not.toBeNull();
    expect(el.querySelector('header button[aria-label="nav.menu"]')).not.toBeNull();
  });

  it('orders the mobile avatar menu: Profile, Sync, Log out (the diary has its own tab)', () => {
    const { fixture, el } = setup();
    el.querySelector<HTMLButtonElement>('button[aria-label="nav.menu"]')!.click();
    fixture.detectChanges();
    const items = [...el.querySelectorAll('header [role="menu"] [role="menuitem"]')].map((i) => i.textContent!.trim());
    expect(items).toEqual(['nav.profile', 'nav.sync', 'nav.logout']);
  });

  it('shows Home, Games, "+", Stats and Diary in the mobile tab bar', () => {
    const { el } = setup();
    const bar = el.querySelector('nav.fixed')!;
    const entries = [...bar.children].map((child) =>
      child.matches('[data-add-menu]') ? '+' : child.getAttribute('href'),
    );
    expect(entries).toEqual(['/dashboard', '/games', '+', '/stats', '/diary']);
  });

  it('lights the Stats tab on the years and sagas pages it groups', async () => {
    const { fixture, el } = setup();
    const router = TestBed.inject(Router);
    for (const url of ['/stats', '/stats/activity?year=2025', '/years/2024', '/sagas/3']) {
      await router.navigateByUrl(url);
      fixture.detectChanges();
      const current = [...el.querySelectorAll('a[aria-current="page"]')].map((a) => a.getAttribute('href'));
      // Web tab and mobile tab.
      expect(current).toEqual(['/stats', '/stats']);
    }
    await router.navigateByUrl('/games/7');
    fixture.detectChanges();
    expect([...el.querySelectorAll('a[aria-current="page"]')].map((a) => a.getAttribute('href'))).toEqual([
      '/games',
      '/games',
    ]);
  });

  it('matches a tab on its own path and below it only', () => {
    const stats = { path: '/stats', also: ['/years'] };
    expect(isTabActive(stats, '/stats')).toBe(true);
    expect(isTabActive(stats, '/years?x=1')).toBe(true);
    expect(isTabActive(stats, '/statsx')).toBe(false);
    expect(isTabActive({ path: '/games' }, '/games#top')).toBe(true);
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

  it('links the diary from the web tabs and opens today from the "+" menu', async () => {
    const { fixture, el } = setup();
    expect(el.querySelector('nav a[href="/diary"]')).not.toBeNull();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    el.querySelectorAll<HTMLButtonElement>('[data-add-menu] > button')[1].click();
    fixture.detectChanges();
    const diaryItem = [...el.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
      (b) => b.textContent!.trim() === 'nav.addDiary',
    );
    diaryItem!.click();
    expect(navigate).toHaveBeenCalledWith(['/diary'], { queryParams: { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } });
  });
});
