import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import {
  DIARY_REMINDER_ID,
  DIARY_REMINDER_PLATFORM,
  DiaryReminderService,
  LocalNotificationsPort,
  parseReminderTime,
  reminderNotification,
} from './diary-reminder.service';

function fakePlugin(permission = 'granted', afterRequest = permission) {
  let listener: ((action: { notification: { id: number } }) => void) | null = null;
  const plugin = {
    checkPermissions: vi.fn(async () => ({ display: permission })),
    requestPermissions: vi.fn(async () => ({ display: afterRequest })),
    schedule: vi.fn(async () => ({})),
    cancel: vi.fn(async () => undefined),
    addListener: vi.fn(async (_event: string, fn: typeof listener) => {
      listener = fn;
      return {};
    }),
  };
  return { plugin, tap: (id: number) => listener?.({ notification: { id } }) };
}

function setup(available: boolean, plugin: Partial<LocalNotificationsPort>) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTranslateService(),
      { provide: DIARY_REMINDER_PLATFORM, useValue: { available, load: async () => ({ notifications: plugin }) } },
    ],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('es', {
    diary: { reminder: { title: '¿A qué has jugado hoy?', body: 'Apúntalo' } },
  });
  translate.use('es');
  return TestBed.inject(DiaryReminderService);
}

describe('reminder notification', () => {
  it('parses HH:MM times', () => {
    expect(parseReminderTime('22:00')).toEqual({ hour: 22, minute: 0 });
    expect(parseReminderTime('07:05')).toEqual({ hour: 7, minute: 5 });
    for (const bad of ['24:00', '7:05', '22:60', '', null]) {
      expect(parseReminderTime(bad)).toBeNull();
    }
  });

  it('repeats every day at the chosen local time and points at the diary', () => {
    expect(reminderNotification('21:30', 'Title', 'Body')).toEqual({
      id: DIARY_REMINDER_ID,
      title: 'Title',
      body: 'Body',
      schedule: { on: { hour: 21, minute: 30 }, allowWhileIdle: true },
      extra: { route: '/diary' },
    });
    expect(reminderNotification('nope', 'T', 'B')).toBeNull();
  });
});

describe('DiaryReminderService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('does nothing outside the Android app', async () => {
    const { plugin } = fakePlugin();
    const service = setup(false, plugin);

    expect(await service.apply(true, '22:00')).toBe('unavailable');
    await service.init();
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(plugin.addListener).not.toHaveBeenCalled();
  });

  it('replaces any previous reminder with one at the new time', async () => {
    const { plugin } = fakePlugin();
    const service = setup(true, plugin);

    expect(await service.apply(true, '20:15')).toBe('scheduled');

    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: DIARY_REMINDER_ID }] });
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
    expect(plugin.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: DIARY_REMINDER_ID,
          title: '¿A qué has jugado hoy?',
          schedule: { on: { hour: 20, minute: 15 }, allowWhileIdle: true },
        }),
      ],
    });
    expect(plugin.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      plugin.schedule.mock.invocationCallOrder[0],
    );
  });

  it('asks for the permission and schedules nothing when it is refused', async () => {
    const { plugin } = fakePlugin('prompt', 'denied');
    const service = setup(true, plugin);

    expect(await service.apply(true, '22:00')).toBe('denied');
    expect(plugin.requestPermissions).toHaveBeenCalled();
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('cancels when turned off', async () => {
    const { plugin } = fakePlugin();
    const service = setup(true, plugin);

    expect(await service.apply(false, '22:00')).toBe('cancelled');
    expect(plugin.cancel).toHaveBeenCalled();
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('reports a plugin failure instead of throwing', async () => {
    const { plugin } = fakePlugin();
    plugin.schedule.mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const service = setup(true, plugin);

    expect(await service.apply(true, '22:00')).toBe('failed');
  });

  it('opens today in the diary when the reminder is tapped', async () => {
    const { plugin, tap } = fakePlugin();
    const service = setup(true, plugin);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await service.init();
    tap(999);
    expect(navigate).not.toHaveBeenCalled();
    tap(DIARY_REMINDER_ID);
    expect(navigate).toHaveBeenCalledWith(['/diary'], {
      queryParams: { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    });
  });
});

describe('DiaryReminderService with a Capacitor-like plugin proxy', () => {
  it('still schedules when the plugin answers `then` (a proxy never resolves it)', async () => {
    const { plugin } = fakePlugin();
    // Capacitor plugin proxies expose every property; awaiting one directly would hang forever.
    const proxy = Object.assign(plugin, { then: () => new Promise(() => undefined) });
    const service = setup(true, proxy);
    await expect(service.apply(true, '22:00')).resolves.toBe('scheduled');
  });
});
