import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideChartColumn } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Navbar } from '../../shared/navbar/navbar';

/** Placeholder for the yearly summary (/years, /years/:year), designed in a later phase. */
@Component({
  selector: 'app-years',
  imports: [Navbar, TranslatePipe, LucideChartColumn],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-navbar />
    <main class="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-10">
      <h1 class="text-[26px] font-semibold tracking-[-0.02em] md:text-[30px]">
        {{ 'years.title' | translate }}
      </h1>
      <div
        class="mt-6 flex flex-col items-center gap-3 rounded-[14px] border border-border bg-surface px-6 py-14 text-center"
      >
        <svg lucideChartColumn [size]="28" class="text-brand-light"></svg>
        <p class="text-sm text-muted">{{ 'years.comingSoon' | translate }}</p>
      </div>
    </main>
  `,
})
export class Years {}
