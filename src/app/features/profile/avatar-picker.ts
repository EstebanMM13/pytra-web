import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Avatar } from '../../shared/ui/avatar';
import { AVATAR_CATEGORIES, findAvatar } from '../../shared/ui/avatar-catalog';

/**
 * Preset avatars grouped by category, after a "no avatar" (initial) option. Presentational: it only
 * emits the picked key (null = initial); the profile page saves it.
 */
@Component({
  selector: 'app-avatar-picker',
  imports: [Avatar, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-4' },
  template: `
    <ul class="grid grid-cols-4 gap-2 sm:grid-cols-8">
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
    </ul>
    @for (category of categories; track category.id) {
      <section [attr.aria-labelledby]="'avatar-cat-' + category.id">
        <h3
          [id]="'avatar-cat-' + category.id"
          class="mb-2 text-[11px] font-semibold tracking-[0.08em] text-faint uppercase"
        >
          {{ 'profile.avatar.categories.' + category.id | translate }}
        </h3>
        <ul class="grid grid-cols-4 gap-2 sm:grid-cols-8">
          @for (key of category.keys; track key) {
            <li class="flex justify-center">
              <button
                type="button"
                (click)="pick(key)"
                [disabled]="disabled()"
                [attr.aria-pressed]="current() === key"
                [attr.aria-label]="'profile.avatar.names.' + key | translate"
                [title]="'profile.avatar.names.' + key | translate"
                [class]="optionClass(current() === key)"
              >
                <app-avatar size="md" lazy [avatar]="key" />
              </button>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class AvatarPicker {
  /** Currently saved key (null/unknown = initial). */
  readonly selected = input<string | null | undefined>(null);
  /** Display name for the initial option. */
  readonly name = input<string | null | undefined>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly picked = output<string | null>();

  protected readonly categories = AVATAR_CATEGORIES;

  /** The saved key when it is a known preset, otherwise null (the initial option is highlighted). */
  protected current(): string | null {
    return findAvatar(this.selected());
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
