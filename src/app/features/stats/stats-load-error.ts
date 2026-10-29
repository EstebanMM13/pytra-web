import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Failed load card of a stats section, with a retry button. */
@Component({
  selector: 'app-stats-load-error',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex flex-col items-center gap-3 rounded-[14px] border border-card-border card-glass px-6 py-12 text-center',
  },
  template: `
    <p class="text-sm text-muted">{{ 'stats.loadError' | translate }}</p>
    <button
      type="button"
      (click)="retry.emit()"
      class="rounded-lg border border-border px-4 py-2 text-sm text-text-2 hover:border-border-strong"
    >
      {{ 'stats.retry' | translate }}
    </button>
  `,
})
export class StatsLoadError {
  readonly retry = output<void>();
}
