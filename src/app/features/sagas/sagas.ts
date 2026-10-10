import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideChevronLeft, LucidePencil, LucidePlus } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin, map } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { Saga } from '../../core/models/saga.model';
import { GameService } from '../../core/services/game.service';
import { SagaService } from '../../core/services/saga.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { SectionHeader } from '../../shared/ui/section-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatCard } from '../../shared/ui/stat-card';
import { StatusPill } from '../../shared/ui/status-pill';
import { SagaDialog } from './saga-dialog';
import { SagaSummary, isPlayed, playedPercent, releaseYear, sagaMetaLine, summarizeSagas } from './saga.logic';

/**
 * Sagas master-detail. `/sagas` and `/sagas/:id` render this same view: on web the list and the
 * selected saga sit side by side (first saga when none is in the URL); on mobile `/sagas` is the
 * list and `/sagas/:id` the detail screen.
 */
@Component({
  selector: 'app-sagas',
  imports: [
    RouterLink,
    TranslatePipe,
    Navbar,
    HoursPipe,
    RatingPipe,
    SectionHeader,
    Skeleton,
    StatCard,
    StatusPill,
    SagaDialog,
    LucideChevronLeft,
    LucidePencil,
    LucidePlus,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sagas.html',
})
export class Sagas {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sagaService = inject(SagaService);
  private readonly gameService = inject(GameService);

  protected readonly skeletons = [0, 1, 2, 3, 4];
  protected readonly isPlayed = isPlayed;
  protected readonly releaseYear = releaseYear;
  protected readonly playedPercent = playedPercent;
  protected readonly metaLine = sagaMetaLine;

  private readonly sagas = signal<Saga[] | null>(null);
  private readonly games = signal<Game[]>([]);
  protected readonly loadError = signal(false);
  /** Dialog state: `undefined` closed, `null` creating, a saga when editing. */
  protected readonly dialog = signal<Saga | null | undefined>(undefined);

  /** Saga id in the URL, or null on `/sagas`. */
  protected readonly routeId = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get('id'));
        return Number.isInteger(id) && id > 0 ? id : null;
      }),
    ),
    { requireSync: true },
  );

  protected readonly loading = computed(() => this.sagas() === null);
  protected readonly summaries = computed(() => summarizeSagas(this.sagas() ?? [], this.games()));

  protected readonly selected = computed<SagaSummary | null>(() => {
    const list = this.summaries();
    const id = this.routeId();
    return (id === null ? list[0] : list.find((s) => s.saga.id === id)) ?? null;
  });

  constructor() {
    // `?create=1` (from the navbar "Añadir" menu) opens the create dialog once.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (params.get('create') === '1') {
        this.dialog.set(null);
        void this.router.navigate([], { queryParams: { create: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });
    forkJoin([this.sagaService.findAll(), this.gameService.findAll()]).subscribe({
      next: ([sagas, games]) => {
        this.games.set(games);
        this.sagas.set(sagas);
      },
      error: () => {
        this.loadError.set(true);
        this.sagas.set([]);
      },
    });
  }

  protected onSaved(saga: Saga): void {
    const creating = this.dialog() === null;
    this.dialog.set(undefined);
    this.sagas.update((list) =>
      creating ? [...(list ?? []), saga] : (list ?? []).map((s) => (s.id === saga.id ? saga : s)),
    );
    if (creating) {
      this.router.navigate(['/sagas', saga.id]);
    }
  }

  protected onDeleted(id: number): void {
    this.dialog.set(undefined);
    this.sagas.update((list) => (list ?? []).filter((s) => s.id !== id));
    // The API leaves the saga's games without saga.
    this.games.update((list) => list.map((g) => (g.sagaId === id ? { ...g, sagaId: null, sagaName: null } : g)));
    this.router.navigate(['/sagas'], { replaceUrl: true });
  }
}
