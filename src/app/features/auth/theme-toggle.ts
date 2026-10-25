import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { ThemeService } from '../../core/services/theme.service';
import { ICONS } from '../../shared/ui/icons';

/**
 * Light/dark switch for the signed-out screens. Flips between the explicit themes based on the
 * currently effective one (a "system" preference resolves first), so one tap always changes what
 * the user sees. Shows the theme it switches to: moon in light mode, sun in dark mode.
 */
@Component({
  selector: 'app-theme-toggle',
  imports: [LucideDynamicIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="toggle()"
      class="press flex size-11 items-center justify-center rounded-full border border-card-border bg-surface/70 text-text-2 backdrop-blur-sm hover:border-border-strong hover:text-text"
      [attr.aria-label]="labelKey() | translate"
      [attr.title]="labelKey() | translate"
    >
      <svg [lucideIcon]="isLight() ? icons.moon : icons.sun" [size]="20" aria-hidden="true"></svg>
    </button>
  `,
})
export class ThemeToggle {
  private readonly themeService = inject(ThemeService);
  protected readonly icons = ICONS;

  protected readonly isLight = computed(() => this.themeService.theme() === 'light');
  protected readonly labelKey = computed(() => (this.isLight() ? 'theme.switchToDark' : 'theme.switchToLight'));

  toggle(): void {
    this.themeService.setPreference(this.isLight() ? 'dark' : 'light');
  }
}
