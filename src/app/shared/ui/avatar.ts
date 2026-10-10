import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  LucideCastle,
  LucideCrown,
  LucideDynamicIcon,
  LucideFlame,
  LucideGamepad2,
  LucideGhost,
  LucideIconInput,
  LucideJoystick,
  LucideRocket,
  LucideShield,
  LucideSkull,
  LucideSwords,
  LucideTrophy,
  LucideZap,
} from '@lucide/angular';

export interface AvatarOption {
  /** Stored key; must match the API allowlist (AvatarPolicy.KEYS). */
  key: string;
  icon: LucideIconInput;
  /** Gradient stops (top-left -> bottom-right). Mid-tone colors under a white icon read well on both themes. */
  from: string;
  to: string;
}

/** Preset profile avatars, in picker order. */
export const AVATARS: readonly AvatarOption[] = [
  { key: 'gamepad', icon: LucideGamepad2, from: '#8b6cff', to: '#5131b8' },
  { key: 'joystick', icon: LucideJoystick, from: '#f472b6', to: '#b4307a' },
  { key: 'swords', icon: LucideSwords, from: '#f2a65a', to: '#b45a24' },
  { key: 'shield', icon: LucideShield, from: '#4fa8f0', to: '#2158a8' },
  { key: 'crown', icon: LucideCrown, from: '#e8b54d', to: '#a0670f' },
  { key: 'ghost', icon: LucideGhost, from: '#a3abc9', to: '#565f85' },
  { key: 'skull', icon: LucideSkull, from: '#6e6873', to: '#2e2a33' },
  { key: 'rocket', icon: LucideRocket, from: '#3cc8d8', to: '#17758f' },
  { key: 'zap', icon: LucideZap, from: '#f6c234', to: '#d9601a' },
  { key: 'flame', icon: LucideFlame, from: '#ff825e', to: '#c8332b' },
  { key: 'trophy', icon: LucideTrophy, from: '#44cf93', to: '#1b7f55' },
  { key: 'castle', icon: LucideCastle, from: '#7f8ce6', to: '#3a3f94' },
];

const AVATARS_BY_KEY = new Map(AVATARS.map((a) => [a.key, a]));

/** The preset for a stored key; null when the key is empty or unknown (the initial is shown instead). */
export function findAvatar(key: string | null | undefined): AvatarOption | null {
  return (key && AVATARS_BY_KEY.get(key)) || null;
}

/** First letter of the display name, the fallback when no preset avatar is set. */
export function avatarInitial(name: string | null | undefined): string {
  return (name?.trim().charAt(0) || '?').toUpperCase();
}

export type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: 'size-[34px] text-[13px]',
  md: 'size-11 text-base',
  lg: 'size-14 text-[22px] lg:size-[72px] lg:text-[28px]',
};

/**
 * Round user avatar: the preset icon on its gradient, or the name's initial on brand tint.
 * Always decorative (aria-hidden): the surrounding link/button carries the accessible name.
 */
@Component({
  selector: 'app-avatar',
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class]': 'hostClass()',
    '[style.background]': 'background()',
  },
  template: `
    @if (preset(); as p) {
      <svg [lucideIcon]="p.icon" class="size-1/2 drop-shadow-[0_1px_1px_#0004]"></svg>
    } @else {
      {{ initial() }}
    }
  `,
})
export class Avatar {
  /** Stored avatar key (null/unknown falls back to the initial). */
  readonly avatar = input<string | null | undefined>(null);
  /** Display name the fallback initial comes from. */
  readonly name = input<string | null | undefined>(null);
  readonly size = input<AvatarSize>('sm');

  protected readonly preset = computed(() => findAvatar(this.avatar()));
  protected readonly initial = computed(() => avatarInitial(this.name()));
  protected readonly background = computed(() => {
    const p = this.preset();
    return p ? `linear-gradient(135deg, ${p.from}, ${p.to})` : null;
  });
  protected readonly hostClass = computed(() =>
    [
      'flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
      SIZE_CLASS[this.size()],
      this.preset()
        ? 'text-white ring-1 ring-white/15 ring-inset'
        : 'bg-brand-tint text-brand-lighter',
    ].join(' '),
  );
}
