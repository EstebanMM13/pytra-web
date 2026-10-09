import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { GenreStat, MostPlayedGame, SagaStat, StatsSummary, TopRatedExperience, YearStat } from '../../core/models/stats.model';
import { StatsService } from '../../core/services/stats.service';
import { UserService } from '../../core/services/user.service';
import { Navbar } from '../../shared/navbar/navbar';

@Component({
  selector: 'app-dashboard',
  imports: [Navbar, TranslatePipe],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly statsService = inject(StatsService);
  protected readonly displayName = inject(UserService).displayName;

  readonly summary = signal<StatsSummary | null>(null);
  readonly byYear = signal<YearStat[]>([]);
  readonly bySaga = signal<SagaStat[]>([]);
  readonly byGenre = signal<GenreStat[]>([]);
  readonly topRated = signal<TopRatedExperience[]>([]);
  readonly mostPlayedSingleplayer = signal<MostPlayedGame[]>([]);
  readonly mostPlayedOnline = signal<MostPlayedGame[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.loadStats();
  }

  private loadStats(): void {
    this.statsService.getSummary().subscribe((s) => this.summary.set(s));
    this.statsService.getByYear().subscribe((s) => this.byYear.set(s));
    this.statsService.getBySaga().subscribe((s) => this.bySaga.set(s));
    this.statsService.getByGenre().subscribe((s) => this.byGenre.set(s));
    this.statsService.getTopRated(5).subscribe((s) => this.topRated.set(s));
    this.statsService.getMostPlayedSingleplayer(5).subscribe((s) => this.mostPlayedSingleplayer.set(s));
    this.statsService.getMostPlayedOnline(5).subscribe((s) => {
      this.mostPlayedOnline.set(s);
      this.loading.set(false);
    });
  }
}
