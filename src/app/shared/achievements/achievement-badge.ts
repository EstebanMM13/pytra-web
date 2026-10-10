import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import {
  LucideArchive,
  LucideCalendar,
  LucideCrown,
  LucideDynamicIcon,
  LucideFlame,
  LucideGem,
  LucideIconInput,
  LucideLayers,
  LucideLibrary,
  LucideMedal,
  LucideMonitor,
  LucidePlay,
  LucideStar,
  LucideTimer,
  LucideTrophy,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Achievement, AchievementIcon } from './achievements';

const ICONS: Record<AchievementIcon, LucideIconInput> = {
  trophy: LucideTrophy,
  crown: LucideCrown,
  timer: LucideTimer,
  play: LucidePlay,
  flame: LucideFlame,
  medal: LucideMedal,
  library: LucideLibrary,
  archive: LucideArchive,
  gem: LucideGem,
  layers: LucideLayers,
  star: LucideStar,
  monitor: LucideMonitor,
  calendar: LucideCalendar,
};

/** Achievement tile: brand-tinted icon when unlocked, muted with a progress bar when locked. */
@Component({
  selector: 'app-achievement-badge',
  imports: [LucideDynamicIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 items-center gap-3' },
  template: `
    <span
      class="flex shrink-0 items-center justify-center rounded-xl"
      [class]="
        (compact() ? 'size-9 ' : 'size-11 ') +
        (a().unlocked ? 'bg-brand-tint text-brand-lighter' : 'border border-dashed border-border bg-bg text-faint')
      "
      aria-hidden="true"
    >
      <svg [lucideIcon]="icon()" [size]="compact() ? 16 : 20"></svg>
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-medium" [class]="a().unlocked ? 'text-text' : 'text-text-3'">
        {{ 'achievements.items.' + a().id + '.title' | translate }}
      </span>
      @if (!compact()) {
        <span class="mt-0.5 block text-xs text-muted">
          {{ 'achievements.items.' + a().id + '.desc' | translate: { target: a().target } }}
        </span>
        @if (!a().unlocked) {
          <span class="mt-1.5 flex items-center gap-2">
            <span
              class="block h-1 flex-1 overflow-hidden rounded-full bg-bg"
              role="progressbar"
              [attr.aria-valuenow]="percent()"
              aria-valuemin="0"
              aria-valuemax="100"
              [attr.aria-label]="'achievements.progress' | translate"
            >
              <span class="block h-full rounded-full bg-brand-light/60" [style.width.%]="percent()"></span>
            </span>
            @if (a().target > 1) {
              <span class="shrink-0 font-mono text-[11px] text-faint">{{ shown() }}/{{ a().target }}</span>
            }
          </span>
        }
      }
    </span>
  `,
})
export class AchievementBadge {
  readonly achievement = input.required<Achievement>();
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly a = this.achievement;
  protected readonly icon = computed(() => ICONS[this.achievement().icon]);
  protected readonly percent = computed(() => Math.round(this.achievement().progress * 100));
  protected readonly shown = computed(() => Math.min(Math.floor(this.achievement().current), this.achievement().target));
}
