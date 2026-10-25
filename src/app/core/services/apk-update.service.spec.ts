import { TestBed } from '@angular/core/testing';
import { ANDROID_APK_URL } from './android-app.service';
import {
  APK_DOWNLOAD_FILE,
  APK_UPDATE_ENV,
  ApkInstallerPlugin,
  ApkUpdateEnv,
  ApkUpdateService,
} from './apk-update.service';

const RELEASE_JSON = {
  tag_name: 'v1.0.5',
  assets: [{ name: 'pytra.apk', browser_download_url: 'https://example.test/v1.0.5/pytra.apk' }],
};
const RELEASE = { version: '1.0.5', apkUrl: 'https://example.test/v1.0.5/pytra.apk' };
const APK_PATH = '/data/cache/pytra-update.apk';
const TODAY = new Date(2026, 9, 25, 10);

type ProgressListener = (p: { bytes: number; contentLength: number }) => void;

describe('ApkUpdateService', () => {
  function setup(overrides: Partial<ApkUpdateEnv> = {}, installedVersion = '1.0.4') {
    const fs = { progress: undefined as ProgressListener | undefined };
    const remove = vi.fn(() => Promise.resolve());
    const Filesystem = {
      addListener: vi.fn((_event: string, listener: ProgressListener) => {
        fs.progress = listener;
        return Promise.resolve({ remove });
      }),
      downloadFile: vi.fn((): Promise<{ path?: string }> => {
        fs.progress?.({ bytes: 50, contentLength: 200 });
        return Promise.resolve({ path: APK_PATH });
      }),
    };
    const installer: ApkInstallerPlugin = {
      canInstall: vi.fn(() => Promise.resolve({ value: true })),
      openInstallSettings: vi.fn(() => Promise.resolve()),
      install: vi.fn(() => Promise.resolve()),
    };
    let snooze: string | null = null;
    const env: ApkUpdateEnv = {
      platform: 'android',
      fetchLatestRelease: vi.fn(() => Promise.resolve(RELEASE_JSON)),
      loadApp: vi.fn(() =>
        Promise.resolve({ App: { getInfo: () => Promise.resolve({ version: installedVersion }) } } as never),
      ),
      loadFilesystem: vi.fn(() => Promise.resolve({ Filesystem, Directory: { Cache: 'CACHE' } } as never)),
      loadInstaller: vi.fn(() => Promise.resolve({ plugin: installer })),
      readSnooze: () => snooze,
      writeSnooze: vi.fn((value: string) => {
        snooze = value;
      }),
      now: () => TODAY,
      ...overrides,
    };
    TestBed.configureTestingModule({ providers: [{ provide: APK_UPDATE_ENV, useValue: env }] });
    return { service: TestBed.inject(ApkUpdateService), env, Filesystem, fs, installer, remove };
  }

  /** Lets the fire-and-forget download chain settle. */
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('offers a newer release, checking only once per launch', async () => {
    const { service, env } = setup();

    await service.checkOnLaunch();
    expect(service.state()).toEqual({ step: 'available', release: RELEASE });

    service.dismiss();
    await service.checkOnLaunch();
    expect(service.state()).toEqual({ step: 'idle' });
    expect(env.fetchLatestRelease).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the installed version is current', async () => {
    const { service } = setup({}, '1.0.5');
    await service.checkOnLaunch();
    expect(service.state()).toEqual({ step: 'idle' });
  });

  it('never runs outside the Android shell', async () => {
    for (const platform of ['web', 'ios'] as const) {
      const { service, env } = setup({ platform });
      await service.checkOnLaunch();
      expect(await service.update()).toBe(false);
      expect(env.fetchLatestRelease).not.toHaveBeenCalled();
      expect(service.state()).toEqual({ step: 'idle' });
      TestBed.resetTestingModule();
    }
  });

  it('fails silently when GitHub is unreachable', async () => {
    const { service } = setup({ fetchLatestRelease: vi.fn(() => Promise.reject(new Error('offline'))) });
    await expect(service.checkOnLaunch()).resolves.toBeUndefined();
    expect(service.state()).toEqual({ step: 'idle' });
  });

  it('"Later" hides the prompt for that version for the rest of the day', async () => {
    const first = setup();
    await first.service.checkOnLaunch();
    first.service.later();
    expect(first.service.state()).toEqual({ step: 'idle' });
    expect(first.env.writeSnooze).toHaveBeenCalledWith('1.0.5|2026-10-25');

    TestBed.resetTestingModule();
    const sameDay = setup({ readSnooze: () => '1.0.5|2026-10-25' });
    await sameDay.service.checkOnLaunch();
    expect(sameDay.service.state()).toEqual({ step: 'idle' });

    TestBed.resetTestingModule();
    const otherVersion = setup({ readSnooze: () => '1.0.4|2026-10-25' });
    await otherVersion.service.checkOnLaunch();
    expect(otherVersion.service.state().step).toBe('available');
  });

  it('downloads the APK into the cache and starts the installer', async () => {
    const { service, Filesystem, installer, remove } = setup();
    await service.checkOnLaunch();

    expect(await service.update()).toBe(true);
    expect(service.state()).toEqual({ step: 'downloading', release: RELEASE, percent: 0 });
    await flush();

    expect(Filesystem.downloadFile).toHaveBeenCalledWith({
      url: RELEASE.apkUrl,
      path: APK_DOWNLOAD_FILE,
      directory: 'CACHE',
      progress: true,
    });
    expect(installer.install).toHaveBeenCalledWith({ path: APK_PATH });
    expect(service.state()).toEqual({ step: 'installing', release: RELEASE, path: APK_PATH });
    expect(remove).toHaveBeenCalled();
  });

  it('still installs when the plugin answers `then` (a Capacitor proxy never resolves it)', async () => {
    const proxy = {
      canInstall: vi.fn(() => Promise.resolve({ value: true })),
      openInstallSettings: vi.fn(() => Promise.resolve()),
      install: vi.fn(() => Promise.resolve()),
      then: () => new Promise(() => undefined),
    };
    const { service } = setup({ loadInstaller: vi.fn(() => Promise.resolve({ plugin: proxy })) });
    await service.checkOnLaunch();

    expect(await service.update()).toBe(true);
    await flush();

    expect(proxy.install).toHaveBeenCalledWith({ path: APK_PATH });
    expect(service.state()).toEqual({ step: 'installing', release: RELEASE, path: APK_PATH });
  });

  it('reports download progress as a percentage', async () => {
    const { service, Filesystem, fs } = setup();
    let finish: (value: { path: string }) => void = () => {};
    Filesystem.downloadFile.mockImplementation(() => new Promise((resolve) => (finish = resolve)));

    await service.update();
    await flush();
    fs.progress?.({ bytes: 30, contentLength: 120 });
    expect(service.state()).toMatchObject({ step: 'downloading', percent: 25 });

    finish({ path: APK_PATH });
    await flush();
    expect(service.state().step).toBe('installing');
  });

  it('asks for the "install unknown apps" permission, then retries the install', async () => {
    const { service, installer } = setup();
    vi.mocked(installer.canInstall).mockResolvedValueOnce({ value: false });

    await service.update();
    await flush();
    expect(service.state()).toMatchObject({ step: 'permission', path: APK_PATH });
    expect(installer.install).not.toHaveBeenCalled();

    await service.openInstallSettings();
    expect(installer.openInstallSettings).toHaveBeenCalled();

    await service.retry();
    expect(installer.install).toHaveBeenCalledWith({ path: APK_PATH });
    expect(service.state().step).toBe('installing');
  });

  it('shows an error after a failed download and downloads again on retry', async () => {
    const { service, Filesystem } = setup();
    Filesystem.downloadFile.mockRejectedValueOnce(new Error('network'));

    await service.update();
    await flush();
    expect(service.state().step).toBe('error');

    await service.retry();
    expect(Filesystem.downloadFile).toHaveBeenCalledTimes(2);
    expect(service.state().step).toBe('installing');
  });

  it('uses the stable APK URL when the release API fails from the settings entry', async () => {
    const { service, Filesystem } = setup({
      fetchLatestRelease: vi.fn(() => Promise.reject(new Error('rate limit'))),
    });

    await service.update();
    await flush();
    expect(Filesystem.downloadFile).toHaveBeenCalledWith(expect.objectContaining({ url: ANDROID_APK_URL }));
  });

  it('reports a missing native installer so callers can fall back to the browser', async () => {
    const { service, Filesystem } = setup({ loadInstaller: vi.fn(() => Promise.resolve(null)) });
    expect(await service.update()).toBe(false);
    expect(Filesystem.downloadFile).not.toHaveBeenCalled();
  });
});
