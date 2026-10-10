import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AVATARS, Avatar, findAvatar } from '../../shared/ui/avatar';

/**
 * Grid of preset avatars plus a "no avatar" (initial) option. Presentational: it only emits the
 * picked key (null = initial); the profile page saves it.
 */
@Component({
  selector: 'app-avatar-picker',
  imports: [Avatar, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ul
      class="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2"
      [attr.aria-label]="'profile.avatar.title' | translate"
    >
      <li class="flex justify-center">
        <button
          type="button"
          (click)="pick(null)"
          [disabled]="disabled()"
          [attr.aria-pressed]="!current()"
          [attr.aria-label]="'profile.avatar.none' | translate"
          [title]="'profile.avatar.none' | translate"
          [class]="optionClass(!current())"
        >
          <app-avatar size="md" [name]="name()" />
        </button>
      </li>
      @for (option of avatars; track option.key) {
        <li class="flex justify-center">
          <button
            type="button"
            (click)="pick(option.key)"
            [disabled]="disabled()"
            [attr.aria-pressed]="current() === option.key"
            [attr.aria-label]="'profile.avatar.names.' + option.key | translate"
            [title]="'profile.avatar.names.' + option.key | translate"
            [class]="optionClass(current() === option.key)"
          >
            <app-avatar size="md" [avatar]="option.key" />
          </button>
        </li>
      }
    </ul>
  `,
})
export class AvatarPicker {
  /** Currently saved key (null/unknown = initial). */
  readonly selected = input<string | null | undefined>(null);
  /** Display name for the initial option. */
  readonly name = input<string | null | undefined>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly picked = output<string | null>();

  protected readonly avatars = AVATARS;

  /** The saved key when it is a known preset, otherwise null (the initial option is highlighted). */
  protected current(): string | null {
    return findAvatar(this.selected())?.key ?? null;
  }

  protected pick(key: string | null): void {
    if (key !== this.current()) {
      this.picked.emit(key);
    }
  }

  protected optionClass(active: boolean): string {
    return [
      'rounded-full p-[3px] ring-2 transition-shadow disabled:cursor-wait disabled:opacity-60',
      active ? 'ring-brand-light' : 'ring-transparent hover:ring-border-strong',
    ].join(' ');
  }
}
