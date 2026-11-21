import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/services/auth.service';
import { SPLASH_GATE_DEPS, SplashGate } from './splash-gate';

describe('SplashGate', () => {
  function setup(options: { native?: boolean; reduced?: boolean; seen?: boolean; authenticated?: boolean } = {}) {
    const authenticated = signal(options.authenticated ?? false);
    let seen = options.seen ?? false;
    const writeSeen = vi.fn(() => {
      seen = true;
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: authenticated } },
        {
          provide: SPLASH_GATE_DEPS,
          useValue: {
            native: options.native ?? false,
            reducedMotion: () => options.reduced ?? false,
            readSeen: () => seen,
            writeSeen,
          },
        },
      ],
    });
    const gate = TestBed.inject(SplashGate);
    TestBed.tick();
    return { gate, authenticated, writeSeen };
  }

  it('native: plays on every cold start, signed in or not', () => {
    expect(setup({ native: true }).gate.show()).toBe(true);
  });

  it('native: never with reduced motion', () => {
    expect(setup({ native: true, reduced: true }).gate.show()).toBe(false);
  });

  it('web: plays on load when already signed in, and remembers it for the session', () => {
    const { gate, writeSeen } = setup({ authenticated: true });
    expect(gate.show()).toBe(true);
    expect(writeSeen).toHaveBeenCalledTimes(1);
  });

  it('web: stays off on the login screen and plays right after logging in', () => {
    const { gate, authenticated, writeSeen } = setup();
    expect(gate.show()).toBe(false);

    authenticated.set(true);
    TestBed.tick();
    expect(gate.show()).toBe(true);
    expect(writeSeen).toHaveBeenCalledTimes(1);
  });

  it('web: plays only once per session (not after a logout and a new login)', () => {
    const { gate, authenticated, writeSeen } = setup({ authenticated: true });
    authenticated.set(false);
    TestBed.tick();
    authenticated.set(true);
    TestBed.tick();
    expect(gate.show()).toBe(true);
    expect(writeSeen).toHaveBeenCalledTimes(1);
  });

  it('web: does not play when it already played in this session', () => {
    expect(setup({ authenticated: true, seen: true }).gate.show()).toBe(false);
  });

  it('web: never with reduced motion', () => {
    expect(setup({ authenticated: true, reduced: true }).gate.show()).toBe(false);
  });
});
