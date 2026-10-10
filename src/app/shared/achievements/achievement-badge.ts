import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import {
  LucideArchive,
  LucideAward,
  LucideBookOpen,
  LucideCircleCheck,
  LucideClock,
  LucideGlobe,
  LucideHeart,
  LucideHourglass,
  LucideMountain,
  LucideRepeat,
  LucideShuffle,
  LucideSparkles,
  LucideTarget,
  LucideThumbsDown,
  LucideUsers,
  LucideWifi,
  LucideZap,
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
import { Achievement, AchievementIcon, AchievementTier } from './achievements';

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
  check: LucideCircleCheck,
  repeat: LucideRepeat,
  hourglass: LucideHourglass,
  clock: LucideClock,
  mountain: LucideMountain,
  sparkles: LucideSparkles,
  heart: LucideHeart,
  thumbsDown: LucideThumbsDown,
  award: LucideAward,
  globe: LucideGlobe,
  zap: LucideZap,
  users: LucideUsers,
  wifi: LucideWifi,
  shuffle: LucideShuffle,
  target: LucideTarget,
  bookOpen: LucideBookOpen,
};

/** Unlocked chip tone per tier (bronze = copper, silver = slate, gold = the app's gold). */
const TIER_TONE: Record<AchievementTier, string> = {
  bronze:
    'bg-[color-mix(in_srgb,#c98552_20%,transparent)] text-[#d89a6a] ring-1 ring-[#c98552]/40 light:text-[#8f5428] light:ring-[#a8662f]/40',
  silver:
    'bg-[color-mix(in_srgb,#aab4c3_18%,transparent)] text-[#c4ccd8] ring-1 ring-[#aab4c3]/40 light:text-[#4f5b6b] light:ring-[#6b7787]/40',
  gold: 'bg-gold-tint text-gold-tint-fg ring-1 ring-gold-line',
};

/** Achievement tile: brand-tinted icon when unlocked, muted with a progress bar when locked. */
@Component({
  selector: 'app-achievement-badge',
  imports: [LucideDynamicIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 items-center gap-2.5 md:gap-3' },
  template: `
    <span
      class="flex shrink-0 items-center justify-center rounded-xl"
      [class]="
        (compact() ? 'size-9 ' : 'size-11 ') +
        (a().unlocked ? tone() : 'border border-dashed border-border bg-bg text-faint')
      "
      aria-hidden="true"
    >
      <svg [lucideIcon]="icon()" [size]="compact() ? 16 : 20"></svg>
    </span>
    <span class="min-w-0 flex-1">
      <span
        class="block font-medium"
        [class]="(compact() ? 'line-clamp-2 text-[13px] leading-tight ' : 'truncate text-sm ') + (a().unlocked ? 'text-text' : 'text-text-3')"
        [attr.title]="'achievements.items.' + a().id + '.title' | translate"
      >
        {{ 'achievements.items.' + a().id + '.title' | translate }}
      </span>
      @if (compact() && !a().unlocked) {
        <span class="mt-1 block h-0.5 overflow-hidden rounded-full bg-bg" aria-hidden="true">
          <span class="block h-full rounded-full bg-brand-light/60" [style.width.%]="percent()"></span>
        </span>
      }
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
  protected readonly tone = computed(() => TIER_TONE[this.achievement().tier]);
  protected readonly percent = computed(() => Math.round(this.achievement().progress * 100));
  protected readonly shown = computed(() => Math.min(Math.floor(this.achievement().current), this.achievement().target));
}
