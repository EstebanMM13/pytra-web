import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NATIVE_PLATFORM, NativeOAuthService, NativePlatform, importWithRetry } from './native-oauth.service';

const CALLBACK = 'com.estebanmm13.pytra://oauth-callback?code=abc&next=/steam';

describe('NativeOAuthService', () => {
  let listeners: ((event: { url: string }) => void)[];
  let launchUrl: string | null;
  let navigate: ReturnType<typeof vi.fn>;
  let routerNavigate: ReturnType<typeof vi.fn>;
  let browserOpen: ReturnType<typeof vi.fn>;
  let browserClose: ReturnType<typeof vi.fn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  function app() {
    return {
      App: {
        addListener: vi.fn((_name: string, fn: (event: { url: string }) => void) => {
          listeners.push(fn);
          return Promise.resolve({ remove: vi.fn() });
        }),
        getLaunchUrl: vi.fn(() => Promise.resolve(launchUrl ? { url: launchUrl } : undefined)),
      },
    };
  }

  function setup(platform: Partial<NativePlatform> = {}) {
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: routerNavigate } },
        {
          provide: NATIVE_PLATFORM,
          useValue: {
            isNative: true,
            loadApp: () => Promise.resolve(app()),
            loadBrowser: () => Promise.resolve({ Browser: { open: browserOpen, close: browserClose } }),
            navigate,
            ...platform,
          } as unknown as NativePlatform,
        },
      ],
    });
    return TestBed.inject(NativeOAuthService);
  }

  beforeEach(() => {
    listeners = [];
    launchUrl = null;
    navigate = vi.fn();
    routerNavigate = vi.fn(() => Promise.resolve(true));
    browserOpen = vi.fn(() => Promise.resolve());
    browserClose = vi.fn(() => Promise.resolve());
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  it('handles the cold-start launch URL once, even when it is delivered again', async () => {
    launchUrl = CALLBACK;
    await setup().init();
    expect(routerNavigate).toHaveBeenCalledTimes(1);
    expect(routerNavigate).toHaveBeenCalledWith(['/oauth-callback'], {
      queryParams: { code: 'abc', next: '/steam' },
      replaceUrl: true,
    });

    listeners[0]({ url: CALLBACK });
    expect(routerNavigate).toHaveBeenCalledTimes(1);
    listeners[0]({ url: 'com.estebanmm13.pytra://oauth-callback?code=other' });
    expect(routerNavigate).toHaveBeenCalledTimes(2);
  });

  it('ignores URLs that are not the app callback', async () => {
    await setup().init();
    listeners[0]({ url: 'com.estebanmm13.pytra://oauth-callback.evil?code=x' });
    listeners[0]({ url: 'not a url' });
    expect(routerNavigate).not.toHaveBeenCalled();
  });

  it('retries a failed plugin import once, then logs instead of rejecting', async () => {
    const loadApp = vi.fn(() => Promise.reject(new Error('chunk')));
    await expect(setup({ loadApp }).init()).resolves.toBeUndefined();
    expect(loadApp).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('recovers when the retry succeeds', async () => {
    let calls = 0;
    const result = await importWithRetry(() => (++calls === 1 ? Promise.reject(new Error('x')) : Promise.resolve(42)), 'm');
    expect(result).toBe(42);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('opens the flow in a Custom Tab on native', async () => {
    await setup().openExternalFlow('https://api.example/login?x=1');
    expect(browserOpen).toHaveBeenCalledWith({ url: 'https://api.example/login?x=1&client=android' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('falls back to a page navigation when the Custom Tab cannot open', async () => {
    const loadBrowser = vi.fn(() => Promise.reject(new Error('chunk')));
    await expect(setup({ loadBrowser }).openExternalFlow('https://api.example/login')).resolves.toBeUndefined();
    expect(loadBrowser).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith('https://api.example/login');
    expect(errorSpy).toHaveBeenCalled();

    TestBed.resetTestingModule();
    browserOpen.mockRejectedValueOnce(new Error('no activity'));
    await setup().openExternalFlow('https://api.example/login');
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('navigates the page on the web without loading any plugin', async () => {
    const loadApp = vi.fn();
    const service = setup({ isNative: false, loadApp });
    await service.init();
    await service.openExternalFlow('https://api.example/login');
    expect(loadApp).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('https://api.example/login');
  });
});
