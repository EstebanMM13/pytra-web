import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { ToastService } from '../../shared/toast/toast.service';

/**
 * Offers a reload when the service worker has downloaded a new app version.
 * No-op when the service worker is disabled (dev, Capacitor native, unsupported browsers).
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  init(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }
    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() =>
        this.toast.action(this.translate.instant('update.available') as string, {
          label: 'update.reload',
          run: () => document.location.reload(),
        }),
      );
  }
}
