import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Platform } from '../../core/models/experience.model';

const DOT_CLASS: Record<Platform, string> = {
  PS5: 'bg-platform-playstation',
  PS4: 'bg-platform-playstation',
  XBOX: 'bg-platform-xbox',
  SWITCH: 'bg-platform-switch',
  PC: 'bg-platform-neutral',
  MOBILE: 'bg-platform-neutral',
};

/** Platform name preceded by a small brand-coloured dot. */
@Component({
  selector: 'app-platform-label',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-1.5' },
  template: `
    <span class="size-1.5 shrink-0 rounded-full" [class]="dotClass()" aria-hidden="true"></span>
    <span>{{ 'platform.' + platform() | translate }}</span>
  `,
})
export class PlatformLabel {
  readonly platform = input.required<Platform>();
  protected readonly dotClass = computed(() => DOT_CLASS[this.platform()] ?? 'bg-platform-neutral');
}
