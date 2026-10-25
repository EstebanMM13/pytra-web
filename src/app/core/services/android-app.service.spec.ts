import { TestBed } from '@angular/core/testing';
import {
  ANDROID_APK_URL,
  ANDROID_APP_PLATFORM,
  AndroidAppPlatform,
  AndroidAppService,
  detectAppPlatform,
  isIosUserAgent,
} from './android-app.service';

describe('detectAppPlatform', () => {
  it('tells the Android and iOS shells apart from the web', () => {
    expect(detectAppPlatform({ androidBridge: {} })).toBe('android');
    expect(detectAppPlatform({ webkit: { messageHandlers: { bridge: {} } } })).toBe('ios');
    expect(detectAppPlatform({ CapacitorCustomPlatform: { name: 'android' } })).toBe('android');
    expect(detectAppPlatform({})).toBe('web');
    expect(detectAppPlatform(null)).toBe('web');
  });
});

describe('isIosUserAgent', () => {
  it('matches iPhone, iPad and touch Macs (iPadOS) only', () => {
    expect(isIosUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIosUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIosUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIosUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(false);
  });
});

describe('AndroidAppService', () => {
  function setup(overrides: Partial<AndroidAppPlatform> = {}) {
    const browserOpen = vi.fn(() => Promise.resolve());
    const platform: AndroidAppPlatform = {
      platform: 'web',
      iosBrowser: false,
      loadBrowser: vi.fn(() => Promise.resolve({ Browser: { open: browserOpen } } as never)),
      openWindow: vi.fn(),
      startInAppUpdate: vi.fn(() => Promise.resolve(true)),
      ...overrides,
    };
    TestBed.configureTestingModule({ providers: [{ provide: ANDROID_APP_PLATFORM, useValue: platform }] });
    return { service: TestBed.inject(AndroidAppService), platform, browserOpen };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('points at the latest GitHub release asset', () => {
    expect(ANDROID_APK_URL).toBe('https://github.com/EstebanMM13/pytra-web/releases/latest/download/pytra.apk');
  });

  it('offers a download on the web and lets the link navigate by itself', async () => {
    const { service, platform } = setup();
    const event = new Event('click', { cancelable: true });

    expect(service.available).toBe(true);
    expect(service.labelKey).toBe('profile.downloadAndroidApp');
    await service.open(event);
    expect(event.defaultPrevented).toBe(false);
    expect(platform.loadBrowser).not.toHaveBeenCalled();
  });

  it('offers an update in the Android app and runs it in-app', async () => {
    const { service, platform, browserOpen } = setup({ platform: 'android' });
    const event = new Event('click', { cancelable: true });

    expect(service.available).toBe(true);
    expect(service.labelKey).toBe('profile.updateAndroidApp');
    await service.open(event);
    expect(event.defaultPrevented).toBe(true);
    expect(platform.startInAppUpdate).toHaveBeenCalled();
    expect(browserOpen).not.toHaveBeenCalled();
  });

  it('opens the system browser when the in-app installer is missing or fails to load', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const startInAppUpdate of [
      vi.fn(() => Promise.resolve(false)),
      vi.fn(() => Promise.reject(new Error('chunk'))),
    ]) {
      const { service, browserOpen } = setup({ platform: 'android', startInAppUpdate });
      await service.open(new Event('click', { cancelable: true }));
      expect(browserOpen).toHaveBeenCalledWith({ url: ANDROID_APK_URL });
      TestBed.resetTestingModule();
    }
    error.mockRestore();
  });

  it('falls back to a system window when the Browser plugin cannot load', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { service, platform } = setup({
      platform: 'android',
      startInAppUpdate: vi.fn(() => Promise.resolve(false)),
      loadBrowser: vi.fn(() => Promise.reject(new Error('chunk'))),
    });

    await service.open(new Event('click', { cancelable: true }));
    expect(platform.openWindow).toHaveBeenCalledWith(ANDROID_APK_URL);
    error.mockRestore();
  });

  it('is hidden on iOS, native or browser', () => {
    expect(setup({ platform: 'ios' }).service.available).toBe(false);
    TestBed.resetTestingModule();
    expect(setup({ iosBrowser: true }).service.available).toBe(false);
  });
});
