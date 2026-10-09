import { ChangeDetectionStrategy, booleanAttribute, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ExperienceStatus } from '../../core/models/experience.model';

const TONES: Record<ExperienceStatus, { pill: string; dot: string }> = {
  EN_CURSO: { pill: 'bg-brand-tint text-brand-lighter', dot: 'bg-brand-lighter' },
  COMPLETADO: { pill: 'bg-success-bg text-success', dot: 'bg-success' },
  ABANDONADO: { pill: 'bg-danger-bg text-danger', dot: 'bg-danger' },
  PENDIENTE: { pill: 'bg-neutral-bg text-neutral', dot: 'bg-neutral' },
};

/** Run status as a rounded pill, or as an 8px dot (`dot`) for dense mobile lists. */
@Component({
  selector: 'app-status-pill',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center' },
  template: `
    @if (dot()) {
      <span
        class="size-2 rounded-full"
        [class]="tone().dot"
        role="img"
        [attr.aria-label]="'status.' + status() | translate"
      ></span>
    } @else {
      <span class="rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap" [class]="tone().pill">
        {{ 'status.' + status() | translate }}
      </span>
    }
  `,
})
export class StatusPill {
  readonly status = input.required<ExperienceStatus>();
  readonly dot = input(false, { transform: booleanAttribute });
  protected readonly tone = computed(() => TONES[this.status()]);
}
