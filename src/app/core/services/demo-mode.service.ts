import { Injectable, Injector, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../shared/toast/toast.service';
import { TokenStorageService } from './token-storage.service';

/** Error message the API returns (403) for any write attempted from a demo session. */
export const DEMO_READ_ONLY = 'DEMO_READ_ONLY';

/**
 * UI side of the read-only demo. The demo user sees every button, form and dialog so the app can be
 * explored, but nothing is persisted: dialogs (`ModalSheet`) stop at their save button, and the auth
 * interceptor short-circuits every other write before it leaves the browser. The API still rejects
 * any write from a demo token as the backstop.
 */
@Injectable({ providedIn: 'root' })
export class DemoModeService {
  private readonly toast = inject(ToastService);
  // Resolved lazily: the auth interceptor injects this service, and TranslateService loads its
  // language over HTTP through that interceptor, so an eager inject is a circular dependency
  // (NG0200) that blanks the app on startup.
  private readonly injector = inject(Injector);

  readonly isDemo = inject(TokenStorageService).isDemo;

  notifyReadOnly(): void {
    this.toast.error(this.injector.get(TranslateService).instant('demo.readOnly'));
  }

  /** In demo mode shows the read-only toast and returns true, so callers can skip the write. */
  blockWrite(): boolean {
    if (!this.isDemo()) {
      return false;
    }
    this.notifyReadOnly();
    return true;
  }
}
