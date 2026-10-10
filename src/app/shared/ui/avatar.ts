import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { avatarSrc, findAvatar } from './avatar-catalog';

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
 * Round user avatar: the preset illustration cropped to a circle, or the name's initial on brand tint.
 * Always decorative (aria-hidden, empty alt): the surrounding link/button carries the accessible name.
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class]': 'hostClass()',
  },
  template: `
    @if (src(); as s) {
      <img
        [src]="s"
        alt=""
        width="512"
        height="512"
        decoding="async"
        [attr.loading]="lazy() ? 'lazy' : null"
        draggable="false"
        class="size-full rounded-full object-cover"
      />
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
  /** Defer loading until near the viewport; use in long lists such as the picker. */
  readonly lazy = input(false, { transform: booleanAttribute });

  protected readonly src = computed(() => {
    const key = findAvatar(this.avatar());
    return key ? avatarSrc(key) : null;
  });
  protected readonly initial = computed(() => avatarInitial(this.name()));
  protected readonly hostClass = computed(() =>
    [
      'flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold',
      SIZE_CLASS[this.size()],
      this.src() ? 'ring-1 ring-white/15 ring-inset' : 'bg-brand-tint text-brand-lighter',
    ].join(' '),
  );
}
