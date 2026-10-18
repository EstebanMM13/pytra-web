import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { ToastService } from '../../shared/toast/toast.service';
import { AppUpdateEnv, AppUpdateService, SERVICE_WORKER_URL } from './app-update.service';

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
});
