import { Injectable, InjectionToken, NgZone, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { detectAppPlatform } from './android-app.service';
import { importWithRetry } from './native-oauth.service';
import { todayIso } from '../../shared/utils/run-dates';

/** Id of the one repeating daily reminder (cancel / reschedule target). */
export const DIARY_REMINDER_ID = 4101;
/** Default reminder time, local. */
export const DEFAULT_REMINDER_TIME = '22:00';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `HH:MM` (24 h) to hour and minute; null when it is not a valid time. */
export function parseReminderTime(
  time: string | null | undefined,
): { hour: number; minute: number } | null {
  const match = TIME_PATTERN.exec(time ?? '');
  return match ? { hour: +match[1], minute: +match[2] } : null;
}

/** What the reminder needs from @capacitor/local-notifications (a subset, so tests can fake it). */
export interface LocalNotificationsPort {
  checkPermissions(): Promise<{ display: string }>;
  requestPermissions(): Promise<{ display: string }>;
  schedule(options: { notifications: ReminderNotification[] }): Promise<unknown>;
  cancel(options: { notifications: { id: number }[] }): Promise<void>;
  addListener(
    event: 'localNotificationActionPerformed',
    listener: (action: { notification: { id: number; extra?: unknown } }) => void,
  ): Promise<unknown>;
}

export interface ReminderNotification {
  id: number;
  title: string;
  body: string;
  /** Fires every day at that local time (inexact is fine: no exact-alarm permission needed). */
  schedule: { on: { hour: number; minute: number }; allowWhileIdle: boolean };
  extra: { route: string };
}

/** The daily reminder notification for `time` (`HH:MM`); null for an invalid time. */
export function reminderNotification(
  time: string,
  title: string,
  body: string,
): ReminderNotification | null {
  const at = parseReminderTime(time);
  if (!at) return null;
  return {
    id: DIARY_REMINDER_ID,
    title,
    body,
    schedule: { on: at, allowWhileIdle: true },
    extra: { route: '/diary' },
  };
}

export interface DiaryReminderPlatform {
  /** Only the Android app shows the reminder (no web push). */
  available: boolean;
  load: () => Promise<LocalNotificationsPort>;
}

export const DIARY_REMINDER_PLATFORM = new InjectionToken<DiaryReminderPlatform>(
  'DIARY_REMINDER_PLATFORM',
  {
    providedIn: 'root',
    factory: () => ({
      available: detectAppPlatform() === 'android',
      load: () =>
        import('@capacitor/local-notifications').then(
          ({ LocalNotifications }) => LocalNotifications as unknown as LocalNotificationsPort,
        ),
    }),
  },
);

/** Outcome of turning the reminder on or off. */
export type ReminderResult = 'scheduled' | 'cancelled' | 'denied' | 'unavailable' | 'failed';

/**
 * Daily "What did you play today?" reminder of the Android app: one repeating local notification at
 * the chosen time. Tapping it opens today's diary day.
 */
@Injectable({ providedIn: 'root' })
export class DiaryReminderService {
  private readonly platform = inject(DIARY_REMINDER_PLATFORM);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  readonly available = this.platform.available;

  /** Opens today's diary day when the reminder is tapped. Call once at startup (Android only). */
  async init(): Promise<void> {
    if (!this.available) return;
    try {
      const notifications = await this.plugin();
      await notifications.addListener('localNotificationActionPerformed', ({ notification }) => {
        if (notification.id !== DIARY_REMINDER_ID) return;
        this.zone.run(() => this.openToday());
      });
    } catch (error) {
      console.error('Diary reminder unavailable', error);
    }
  }

  /**
   * Schedules (replacing any previous one) or cancels the reminder. Turning it on asks for the
   * notification permission (Android 13+); a refusal leaves nothing scheduled and answers `denied`.
   */
  async apply(enabled: boolean, time: string): Promise<ReminderResult> {
    if (!this.available) return 'unavailable';
    try {
      const notifications = await this.plugin();
      await notifications.cancel({ notifications: [{ id: DIARY_REMINDER_ID }] });
      if (!enabled) return 'cancelled';

      let permission = (await notifications.checkPermissions()).display;
      if (permission !== 'granted') {
        permission = (await notifications.requestPermissions()).display;
      }
      if (permission !== 'granted') return 'denied';

      const notification = reminderNotification(
        time,
        this.translate.instant('diary.reminder.title') as string,
        this.translate.instant('diary.reminder.body') as string,
      );
      if (!notification) return 'failed';
      await notifications.schedule({ notifications: [notification] });
      return 'scheduled';
    } catch (error) {
      console.error('Could not update the diary reminder', error);
      return 'failed';
    }
  }

  /**
   * A cold start by a tap delivers the event before the first navigation ends; navigating then would
   * be overridden by it, so it waits for that navigation.
   */
  private openToday(): void {
    const go = () => void this.router.navigate(['/diary'], { queryParams: { date: todayIso() } });
    if (this.router.navigated) {
      go();
      return;
    }
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        take(1),
      )
      .subscribe(go);
  }

  private plugin(): Promise<LocalNotificationsPort> {
    return importWithRetry(this.platform.load, '@capacitor/local-notifications');
  }
}
