import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SteamSyncResult } from '../../../core/models/steam.model';
import { TranslatePluralPipe } from '../../../shared/pipes/translate-plural.pipe';
import { SectionHeader } from '../../../shared/ui/section-header';
import { StatCard } from '../../../shared/ui/stat-card';
import { StatStrip } from '../../../shared/ui/stat-strip';
import { SyncSource } from '../sync.logic';

/** Figures every integration reports after a sync. */
export type SyncResultCounts = Omit<SteamSyncResult, 'profilePrivate'>;

/** What the last sync did: four figures at a glance, plus a note for whatever needs attention. */
@Component({
  selector: 'app-sync-result',
  imports: [SectionHeader, StatCard, StatStrip, TranslatePipe, TranslatePluralPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-[14px] border border-card-border card-glass p-4 md:p-[22px]">
      <app-section-header [collapseKey]="source() + '.result'" [label]="source() + '.result.title' | translate" class="mb-3" />
      <app-stat-strip class="grid-cols-2 sm:grid-cols-4">
        <app-stat-card [label]="'sync.result.scanned' | translate" [value]="result().gamesScanned" />
        <app-stat-card [label]="'sync.result.newPending' | translate" [value]="result().newGamesPending" />
        <app-stat-card [label]="'sync.result.linkedExisting' | translate" [value]="result().linkedExisting" />
        <app-stat-card [label]="'sync.result.updated' | translate" [value]="result().gamesUpdated" />
      </app-stat-strip>
      @if (result().ignored > 0 || result().skipped > 0 || result().errored > 0) {
        <ul class="mt-3 flex flex-col gap-1 text-sm text-text-3">
          @if (result().ignored > 0) {
            <li>{{ 'steam.result.ignored' | translatePlural: result().ignored }}</li>
          }
          @if (result().skipped > 0) {
            <li class="text-gold">{{ source() + '.result.skipped' | translatePlural: result().skipped }}</li>
          }
          @if (result().errored > 0) {
            <li class="text-danger">{{ 'steam.result.errored' | translatePlural: result().errored }}</li>
          }
        </ul>
      }
    </section>
  `,
})
export class SyncResult {
  readonly source = input.required<SyncSource>();
  readonly result = input.required<SyncResultCounts>();
}
