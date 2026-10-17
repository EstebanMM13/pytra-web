import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Navbar } from '../../shared/navbar/navbar';
import { ICONS } from '../../shared/ui/icons';
import { SteamPanel } from './steam/steam-panel';

/**
 * Sync page: one card per platform. Steam is fully wired (link, sync, pending review); PlayStation
 * is announced as "coming soon" (no logic yet).
 */
@Component({
  selector: 'app-sync',
  imports: [Navbar, TranslatePipe, LucideDynamicIcon, SteamPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sync.html',
})
export class Sync {
  protected readonly icons = ICONS;
}
