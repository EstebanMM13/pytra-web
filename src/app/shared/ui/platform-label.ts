import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { platformNameKey } from '../../core/services/platform.logic';

/** What the label needs from a catalog platform (a PlatformRef, or an experience's platform fields). */
export interface PlatformLabelValue {
  name: string;
  color?: string | null;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Display name of a catalog platform for text contexts (meta lines, titles). */
export function platformDisplayName(name: string | null | undefined, translate: TranslateService): string {
  const key = platformNameKey(name);
  return key ? (translate.instant(key) as string) : (name ?? '');
}

/** Platform name preceded by a small dot in the catalog color (neutral when it has none). */
@Component({
  selector: 'app-platform-label',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-1.5' },
  template: `
    <span
      class="size-1.5 shrink-0 rounded-full"
      [class.bg-platform-neutral]="!color()"
      [style.background-color]="color()"
      aria-hidden="true"
    ></span>
    @if (nameKey(); as key) {
      <span>{{ key | translate }}</span>
    } @else {
      <span>{{ platform().name }}</span>
    }
  `,
})
export class PlatformLabel {
  readonly platform = input.required<PlatformLabelValue>();
  protected readonly nameKey = computed(() => platformNameKey(this.platform().name));
  /** Only well-formed hex colors reach the style binding. */
  protected readonly color = computed(() => {
    const color = this.platform().color;
    return color && HEX_COLOR.test(color) ? color : null;
  });
}
