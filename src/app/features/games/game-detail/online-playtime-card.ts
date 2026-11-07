import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { PlatformRef } from '../../../core/models/platform.model';
import { platformNameKey } from '../../../core/services/platform.logic';
import { PreferencesService } from '../../../core/services/preferences.service';
import { HoursPipe } from '../../../shared/pipes/hours.pipe';
import { HoursInput } from '../../../shared/ui/hours-input';
import { ICONS } from '../../../shared/ui/icons';
import { PlatformLabel } from '../../../shared/ui/platform-label';
import { SectionHeader } from '../../../shared/ui/section-header';
import { OnlinePlaytimeStore } from './online-playtime.store';

/** Online data of ONLINE / HYBRID games: hours per platform, rating, platinum and 100%. */
@Component({
  selector: 'app-online-playtime-card',
  imports: [
    DecimalPipe,
    HoursInput,
    HoursPipe,
    LucideDynamicIcon,
    NgTemplateOutlet,
    PlatformLabel,
    ReactiveFormsModule,
    SectionHeader,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './online-playtime-card.html',
  styleUrls: ['./online-playtime-card.css', '../../../shared/ui/platinum-glow.css'],
})
export class OnlinePlaytimeCard {
  protected readonly store = inject(OnlinePlaytimeStore);
  protected readonly preferences = inject(PreferencesService);
  protected readonly icons = ICONS;
  protected readonly statIcons = { platinum: ICONS.platinum, fullCompletion: ICONS.badgeCheck };

  protected readonly platformLabel = (name: string): string => platformNameKey(name) ?? name;

  /** Share of the online total per platform id, in %; only with two or more platforms (one is always 100 %). */
  protected readonly shares = computed(() => {
    const split = this.store.onlinePlatformSplit();
    if (!split || this.store.onlinePlatforms().length < 2 || !(split.assigned > 0)) return null;
    return Object.fromEntries(
      Object.entries(split.hours).map(([id, hours]) => [id, (hours / split.assigned) * 100]),
    ) as Record<number, number>;
  });

  /** The platform's catalog colour for its tile; null (neutral) when it has none or it is not a hex colour. */
  protected colorOf(platform: PlatformRef): string | null {
    return platform.color && /^#[0-9a-f]{6}$/i.test(platform.color) ? platform.color : null;
  }

  /** Classes of the h field of the online hours rows: wide enough for 4-5 digit totals (e.g. 1281 h). */
  protected readonly onlineHoursFieldClass =
    'h-8 w-16 min-w-0 rounded-md border border-border bg-surface px-1.5 text-right font-mono text-sm text-text md:w-20';
  /** Classes of the min field of the online hours rows (2 digits). */
  protected readonly onlineMinutesFieldClass =
    'h-8 w-10 min-w-0 rounded-md border border-border bg-surface px-1.5 text-right font-mono text-sm text-text md:w-12';
}
