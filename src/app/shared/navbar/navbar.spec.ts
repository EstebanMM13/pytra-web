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

  it('orders the mobile avatar menu: Profile, Steam, Log out', () => {
    const { fixture, el } = setup();
    el.querySelector<HTMLButtonElement>('button[aria-label="nav.menu"]')!.click();
    fixture.detectChanges();
    const items = [...el.querySelectorAll('header [role="menu"] [role="menuitem"]')].map((i) => i.textContent!.trim());
    expect(items).toEqual(['nav.profile', 'nav.steam', 'nav.logout']);
  });
});
