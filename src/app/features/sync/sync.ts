import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Navbar } from '../../shared/navbar/navbar';
import { PsnPanel } from './psn/psn-panel';
import { SteamPanel } from './steam/steam-panel';

/**
 * Sync page: one panel per platform (Steam, PlayStation), each rendering its own `PlatformCard`
 * plus its sync result, pending review and ignored lists.
 */
@Component({
  selector: 'app-sync',
  imports: [Navbar, TranslatePipe, SteamPanel, PsnPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sync.html',
})
export class Sync {}
