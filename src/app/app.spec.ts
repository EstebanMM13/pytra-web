import { signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { App } from './app';
import { LAUNCH_SPLASH_DEPS } from './core/services/launch-splash.service';
import { SplashGate } from './shared/splash/splash-gate';

describe('App', () => {
  // compileComponents resolves the @defer dependencies (toast host, run form) and loads the
  // unminified @lucide/angular bundle on the way, which can exceed the default hook timeout.
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideTranslateService()],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    })
      .compileComponents();
  }, 60_000);

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('covers the very first frame with the splash purple while the intro chunk loads', () => {
    TestBed.overrideProvider(SplashGate, { useValue: { show: signal(true) } });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-splash-cover]')).not.toBeNull();
  });

  it('without an intro, releases the native splash after its first render', async () => {
    const hideNative = vi.fn(() => Promise.resolve());
    TestBed.overrideProvider(SplashGate, { useValue: { show: signal(false) } });
    TestBed.overrideProvider(LAUNCH_SPLASH_DEPS, { useValue: { native: true, hideNative } });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(hideNative).toHaveBeenCalledTimes(1);
  });

  it('with an intro, leaves the native splash to the intro', async () => {
    const hideNative = vi.fn(() => Promise.resolve());
    TestBed.overrideProvider(SplashGate, { useValue: { show: signal(true) } });
    TestBed.overrideProvider(LAUNCH_SPLASH_DEPS, { useValue: { native: true, hideNative } });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(hideNative).not.toHaveBeenCalled();
  });
});
