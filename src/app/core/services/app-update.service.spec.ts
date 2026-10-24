import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { ToastService } from '../../shared/toast/toast.service';
import { AppUpdateEnv, AppUpdateService, SERVICE_WORKER_URL, SILENT_RELOAD_WINDOW_MS } from './app-update.service';

/** Minimal ServiceWorkerContainer: an EventTarget with register / controller. */
function fakeContainer() {
  const target = new EventTarget() as EventTarget & {
    register: ReturnType<typeof vi.fn>;
    controller: { postMessage: ReturnType<typeof vi.fn> } | null;
  };
  target.register = vi.fn(() => Promise.resolve({}));
  target.controller = { postMessage: vi.fn() };
  return target;
}

describe('AppUpdateService', () => {
  let toast: { action: ReturnType<typeof vi.fn> };

  function setup(enabled = true) {
    toast = { action: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideTranslateService(), { provide: ToastService, useValue: toast }],
    });
    const container = fakeContainer();
    let idleTask: (() => void) | null = null;
    const env: AppUpdateEnv = {
      serviceWorker: container as unknown as ServiceWorkerContainer,
      whenIdle: (task) => (idleTask = task),
      reload: vi.fn(),
    };
    TestBed.inject(TranslateService);
    TestBed.inject(AppUpdateService).init(env, enabled);
    return { container, env, runIdle: () => idleTask?.() };
  }

  it('registers the same worker URL as earlier builds, only once the page is idle', () => {
    const { container, runIdle } = setup();
    expect(container.register).not.toHaveBeenCalled();
    runIdle();
    expect(container.register).toHaveBeenCalledExactlyOnceWith(SERVICE_WORKER_URL);
    expect(SERVICE_WORKER_URL).toBe('ngsw-worker.js?v=2');
  });

  it('offers a reload when the worker reports a downloaded version', () => {
    const { container, env } = setup();
    container.dispatchEvent(new MessageEvent('message', { data: { type: 'VERSION_DETECTED' } }));
    expect(toast.action).not.toHaveBeenCalled();

    container.dispatchEvent(new MessageEvent('message', { data: { type: 'VERSION_READY' } }));
    expect(toast.action).toHaveBeenCalledTimes(1);
    toast.action.mock.calls[0][1].run();
    expect(env.reload).toHaveBeenCalled();
  });

  it('tells a newly controlling worker to initialise', () => {
    const { container } = setup();
    container.dispatchEvent(new Event('controllerchange'));
    expect(container.controller!.postMessage).toHaveBeenCalledWith({ action: 'INITIALIZE' });
  });

  it('does nothing when disabled (dev, native shell)', () => {
    const { container, runIdle } = setup(false);
    runIdle();
    expect(container.register).not.toHaveBeenCalled();
  });

  describe('early updates', () => {
    function setupTimed() {
      toast = { action: vi.fn() };
      TestBed.configureTestingModule({
        providers: [provideTranslateService(), { provide: ToastService, useValue: toast }],
      });
      const container = fakeContainer();
      let clock = 1000;
      let interact: (() => void) | null = null;
      let visible: (() => void) | null = null;
      const env: AppUpdateEnv = {
        serviceWorker: container as unknown as ServiceWorkerContainer,
        whenIdle: () => undefined,
        reload: vi.fn(),
        now: () => clock,
        onFirstInteraction: (listener) => (interact = listener),
        onVisible: (listener) => (visible = listener),
      };
      TestBed.inject(TranslateService);
      TestBed.inject(AppUpdateService).init(env, true);
      return {
        container,
        env,
        advance: (ms: number) => (clock += ms),
        interact: () => interact?.(),
        becomeVisible: () => visible?.(),
      };
    }
    const ready = () => new MessageEvent('message', { data: { type: 'VERSION_READY' } });

    it('asks the worker for updates at start-up and whenever the page becomes visible', () => {
      const { container, becomeVisible } = setupTimed();
      const checks = () =>
        container.controller!.postMessage.mock.calls.filter(([msg]) => msg.action === 'CHECK_FOR_UPDATES').length;
      expect(checks()).toBe(1);
      becomeVisible();
      expect(checks()).toBe(2);
    });

    it('reloads silently when a version is ready right after start-up and nothing was touched', () => {
      const { container, env, advance } = setupTimed();
      advance(3000);
      container.dispatchEvent(ready());
      expect(env.reload).toHaveBeenCalledTimes(1);
      expect(toast.action).not.toHaveBeenCalled();
    });

    it('offers a reload instead once the user has interacted', () => {
      const { container, env, interact } = setupTimed();
      interact();
      container.dispatchEvent(ready());
      expect(env.reload).not.toHaveBeenCalled();
      expect(toast.action).toHaveBeenCalledTimes(1);
    });

    it('offers a reload instead after the start-up window', () => {
      const { container, env, advance } = setupTimed();
      advance(SILENT_RELOAD_WINDOW_MS + 1);
      container.dispatchEvent(ready());
      expect(env.reload).not.toHaveBeenCalled();
      expect(toast.action).toHaveBeenCalledTimes(1);
    });
  });
});
