import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { ICONS } from '../ui/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PreferencesService } from '../../core/services/preferences.service';
import { formatScaledPoint } from '../utils/rating-scale';
import { Achievement, AchievementIcon, AchievementTier, LEGEND_ID, RATING_BADGE_THRESHOLDS } from './achievements';

const BADGE_ICONS: Record<AchievementIcon, LucideIconInput> = {
  trophy: ICONS.trophy,
  crown: ICONS.crown,
  timer: ICONS.timer,
  play: ICONS.play,
  flame: ICONS.flame,
  medal: ICONS.medal,
  library: ICONS.library,
  archive: ICONS.archive,
  gem: ICONS.gem,
  layers: ICONS.layers,
  star: ICONS.star,
  monitor: ICONS.monitor,
  calendar: ICONS.calendar,
  check: ICONS.circleCheck,
  repeat: ICONS.repeat,
  hourglass: ICONS.hourglass,
  clock: ICONS.clock,
  mountain: ICONS.mountain,
  sparkles: ICONS.sparkles,
  heart: ICONS.heart,
  thumbsDown: ICONS.thumbsDown,
  award: ICONS.award,
  globe: ICONS.globe,
  zap: ICONS.zap,
  users: ICONS.users,
  wifi: ICONS.wifi,
  shuffle: ICONS.shuffle,
  target: ICONS.target,
  bookOpen: ICONS.bookOpen,
  badgeCheck: ICONS.badgeCheck,
};

/** Per-instance ids of the legend icon gradient (a page can show the badge more than once). */
let legendGradientSeq = 0;

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
      <svg
        [lucideIcon]="icon()"
        [size]="compact() ? 16 : 20"
        [style.stroke]="legendUnlocked() ? 'url(#' + legendGradientId + ')' : null"
      ></svg>
      @if (legendUnlocked()) {
        <!-- Purple -> gold -> diamond blue icon stroke, in the 24-unit lucide viewBox. -->
        <svg class="absolute size-0" focusable="false">
          <defs>
            <linearGradient [attr.id]="legendGradientId" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="22" y2="22">
              <stop offset="0" style="stop-color: var(--pt-brand-vivid)" />
              <stop offset="0.5" style="stop-color: var(--pt-gold)" />
              <stop offset="1" style="stop-color: var(--pt-diamond)" />
            </linearGradient>
          </defs>
        </svg>
      }
    </span>
    <span class="min-w-0 flex-1">
      <span
        class="block font-medium"
        [class]="(compact() ? 'line-clamp-2 text-[13px] leading-tight ' : 'truncate text-sm ') + (a().unlocked ? 'text-text' : 'text-text-3')"
        [attr.title]="'achievements.items.' + a().id + '.title' | translate"
      >
        {{ 'achievements.items.' + a().id + '.title' | translate }}
      </span>
      @if (compact()) {
        <span class="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted">
          {{ 'achievements.items.' + a().id + '.desc' | translate: descParams() }}
        </span>
      }
      @if (compact() && !a().unlocked) {
        <span class="mt-1 block h-0.5 overflow-hidden rounded-full bg-bg" aria-hidden="true">
          <span class="bar-fill block h-full rounded-full bg-brand-light/60" [style.width.%]="percent()"></span>
        </span>
      }
      @if (!compact()) {
        <span class="mt-0.5 block text-xs text-muted">
          {{ 'achievements.items.' + a().id + '.desc' | translate: descParams() }}
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
              <span class="bar-fill block h-full rounded-full bg-brand-light/60" [style.width.%]="percent()"></span>
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
  protected readonly icon = computed(() => BADGE_ICONS[this.achievement().icon]);
  /** The legend meta badge blends purple, gold and diamond blue instead of a tier tone. */
  protected readonly legendUnlocked = computed(() => this.achievement().id === LEGEND_ID && this.achievement().unlocked);
  protected readonly legendGradientId = `pt-legend-stroke-${++legendGradientSeq}`;
  protected readonly tone = computed(() => (this.legendUnlocked() ? 'legend-badge' : TIER_TONE[this.achievement().tier]));
  protected readonly percent = computed(() => Math.round(this.achievement().progress * 100));
  private readonly preferences = inject(PreferencesService);
  private readonly translate = inject(TranslateService);

  /** Description params: the target plus the rating thresholds on the user's scale ("a 10" -> "a 100"). */
  protected descParams(): Record<string, string | number> {
    const scale = this.preferences.ratingScale();
    const lang = this.translate.currentLang() === 'en' ? 'en' : 'es';
    return {
      target: this.achievement().target,
      max: formatScaledPoint(RATING_BADGE_THRESHOLDS.max, scale, lang),
      high: formatScaledPoint(RATING_BADGE_THRESHOLDS.high, scale, lang),
      low: formatScaledPoint(RATING_BADGE_THRESHOLDS.low, scale, lang),
    };
  }

  protected readonly shown = computed(() => Math.min(Math.floor(this.achievement().current), this.achievement().target));
}
