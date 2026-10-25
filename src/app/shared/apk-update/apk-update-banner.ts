import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { ICONS } from '../ui/icons';
import { ApkUpdateService } from '../../core/services/apk-update.service';

/**
 * Android app update prompt and progress (see ApkUpdateService). Rendered by ToastHost (already a
 * deferred chunk) and only inside the native shell; it runs the once-per-launch version check.
 */
@Component({
  selector: 'app-apk-update-banner',
  imports: [TranslatePipe, LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-5 pt-[calc(env(safe-area-inset-top)+12px)] md:inset-x-auto md:right-6 md:px-0',
  },
  template: `
    @let s = state();
    @if (s.step !== 'idle') {
      <div
        class="pointer-events-auto flex w-full max-w-sm animate-modal-in flex-col gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 text-[13px] text-text-2 shadow-[0_12px_32px_#0006]"
      >
        <div class="flex items-center gap-2.5">
          @if (s.step === 'error') {
            <svg [lucideIcon]="icons.circleAlert" [size]="16" class="shrink-0 text-danger"></svg>
          } @else {
            <svg [lucideIcon]="icons.download" [size]="16" class="shrink-0 text-brand-light"></svg>
          }
          <p class="min-w-0 flex-1">
            @switch (s.step) {
              @case ('available') {
                {{ 'update.apk.available' | translate: { version: s.release.version } }}
              }
              @case ('downloading') {
                {{ 'update.apk.downloading' | translate }}
                <!-- Visible only: the progress bar exposes the value, so the live region stays quiet. -->
                <span aria-hidden="true">{{ s.percent }} %</span>
              }
              @case ('permission') {
                {{ 'update.apk.permission' | translate }}
              }
              @case ('installing') {
                {{ 'update.apk.installing' | translate }}
              }
              @case ('error') {
                {{ 'update.apk.error' | translate }}
              }
            }
          </p>
          @if (s.step !== 'downloading' && s.step !== 'available') {
            <button
              type="button"
              (click)="updates.dismiss()"
              class="shrink-0 rounded-md p-1 text-faint hover:bg-hover hover:text-text"
              [attr.aria-label]="'toast.close' | translate"
            >
              <svg [lucideIcon]="icons.x" [size]="14"></svg>
            </button>
          }
        </div>

        @if (s.step === 'downloading') {
          <div
            class="h-1.5 overflow-hidden rounded-full bg-hover"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-valuenow]="s.percent"
          >
            <div class="h-full rounded-full bg-brand transition" [style.width.%]="s.percent"></div>
          </div>
        } @else {
          <div class="flex justify-end gap-2">
            @switch (s.step) {
              @case ('available') {
                <button type="button" (click)="updates.later()" class="rounded-lg px-3 py-1.5 font-medium text-muted hover:bg-hover hover:text-text">
                  {{ 'update.apk.later' | translate }}
                </button>
                <button type="button" (click)="updates.update()" class="press rounded-lg bg-brand px-3 py-1.5 font-semibold text-white hover:bg-brand-dark">
                  {{ 'update.apk.update' | translate }}
                </button>
              }
              @case ('permission') {
                <button type="button" (click)="updates.openInstallSettings()" class="rounded-lg px-3 py-1.5 font-medium text-brand-light hover:bg-hover">
                  {{ 'update.apk.openSettings' | translate }}
                </button>
                <button type="button" (click)="updates.retry()" class="press rounded-lg bg-brand px-3 py-1.5 font-semibold text-white hover:bg-brand-dark">
                  {{ 'update.apk.install' | translate }}
                </button>
              }
              @case ('installing') {
                <button type="button" (click)="updates.retry()" class="rounded-lg px-3 py-1.5 font-medium text-brand-light hover:bg-hover">
                  {{ 'update.apk.install' | translate }}
                </button>
              }
              @case ('error') {
                <button type="button" (click)="updates.retry()" class="press rounded-lg bg-brand px-3 py-1.5 font-semibold text-white hover:bg-brand-dark">
                  {{ 'update.apk.retry' | translate }}
                </button>
              }
            }
          </div>
        }
      </div>
    }
  `,
})
export class ApkUpdateBanner implements OnInit {
  protected readonly icons = ICONS;
  protected readonly updates = inject(ApkUpdateService);
  protected readonly state = this.updates.state;

  ngOnInit(): void {
    void this.updates.checkOnLaunch();
  }
}
