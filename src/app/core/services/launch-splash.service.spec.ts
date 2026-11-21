import { TestBed } from '@angular/core/testing';
import { LAUNCH_SPLASH_DEPS, LaunchSplash } from './launch-splash.service';

describe('LaunchSplash', () => {
  function setup(native: boolean, hideNative = vi.fn(() => Promise.resolve())) {
    TestBed.configureTestingModule({ providers: [{ provide: LAUNCH_SPLASH_DEPS, useValue: { native, hideNative } }] });
    return { splash: TestBed.inject(LaunchSplash), hideNative };
  }

  it('is released from the start on the web and never calls the native side', async () => {
    const { splash, hideNative } = setup(false);
    expect(splash.released()).toBe(true);
    await splash.release();
    expect(hideNative).not.toHaveBeenCalled();
  });

  it('on native, waits for release() and hides the system splash once', async () => {
    const { splash, hideNative } = setup(true);
    expect(splash.released()).toBe(false);
    await Promise.all([splash.release(), splash.release()]);
    expect(hideNative).toHaveBeenCalledTimes(1);
    expect(splash.released()).toBe(true);
  });

  it('still releases when the native call fails', async () => {
    const { splash } = setup(true, vi.fn(() => Promise.reject(new Error('no plugin'))));
    await splash.release();
    expect(splash.released()).toBe(true);
  });
});
