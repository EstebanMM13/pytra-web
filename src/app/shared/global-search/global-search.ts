import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideChartColumn,
  LucideDownload,
  LucideDynamicIcon,
  LucideGamepad2,
  LucideHouse,
  LucideIconInput,
  LucideLayers,
  LucideSearch,
  LucideUser,
  LucideX,
} from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Game } from '../../core/models/game.model';
import { Saga } from '../../core/models/saga.model';
import { GameService } from '../../core/services/game.service';
import { SagaService } from '../../core/services/saga.service';
import { StatsService } from '../../core/services/stats.service';
import { GameCover } from '../ui/game-cover';
import {
  SearchGroupKind,
  SearchItem,
  SearchPage,
  buildSearchGroups,
  flattenGroups,
  releaseYear,
  searchItemLink,
} from './global-search.logic';

const PAGES: (SearchPage & { icon: LucideIconInput })[] = [
  { path: '/dashboard', labelKey: 'nav.home', icon: LucideHouse },
  { path: '/games', labelKey: 'nav.games', icon: LucideGamepad2 },
  { path: '/sagas', labelKey: 'nav.sagas', icon: LucideLayers },
  { path: '/years', labelKey: 'nav.years', icon: LucideChartColumn },
  { path: '/steam', labelKey: 'nav.steam', icon: LucideDownload },
  { path: '/profile', labelKey: 'nav.profile', icon: LucideUser },
];

const GROUP_LABEL_KEYS: Record<SearchGroupKind, string> = {
  game: 'search.groups.games',
  saga: 'search.groups.sagas',
  year: 'search.groups.years',
  page: 'search.groups.pages',
};

/**
 * Global search (Ctrl/⌘+K or the header search button): games, sagas, years and app sections,
 * grouped. Arrow keys move over the flat list of results, Enter opens, Esc/backdrop closes.
 */
@Component({
  selector: 'app-global-search',
  imports: [TranslatePipe, LucideSearch, LucideX, LucideDynamicIcon, GameCover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './global-search.html',
  host: { '(document:keydown.escape)': 'close()' },
})
export class GlobalSearch {
  private readonly gameService = inject(GameService);
  private readonly sagaService = inject(SagaService);
  private readonly statsService = inject(StatsService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  readonly closed = output<void>();

  protected readonly games = signal<Game[] | null>(null);
  private readonly sagas = signal<Saga[]>([]);
  private readonly years = signal<number[]>([]);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);

  protected readonly groupLabelKeys = GROUP_LABEL_KEYS;
  protected readonly pageIcons = new Map(PAGES.map((p) => [p.path, p.icon]));
  protected readonly sagaIcon = LucideLayers;
  protected readonly yearIcon = LucideChartColumn;
  protected readonly releaseYear = releaseYear;

  private readonly pages = PAGES.map(({ path, labelKey }) => ({
    page: { path, labelKey },
    label: this.translate.instant(labelKey) as string,
  }));

  protected readonly groups = computed(() =>
    buildSearchGroups(
      { games: this.games() ?? [], sagas: this.sagas(), years: this.years(), pages: this.pages },
      this.query(),
    ),
  );
  private readonly flat = computed(() => flattenGroups(this.groups()));
  protected readonly resultCount = computed(() => this.flat().length);

  constructor() {
    this.gameService.findAll().subscribe({
      next: (games) => this.games.set(games),
      error: () => this.games.set([]),
    });
    this.sagaService.findAll().subscribe({ next: (sagas) => this.sagas.set(sagas), error: () => undefined });
    this.statsService.getYears().subscribe({ next: (years) => this.years.set(years), error: () => undefined });
    afterNextRender(() => this.input().nativeElement.focus());
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.resultCount();
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      this.setActive((this.activeIndex() + 1) % count);
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      this.setActive((this.activeIndex() - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.flat()[this.activeIndex()];
      if (item) {
        this.open(item);
      }
    }
  }

  protected open(item: SearchItem): void {
    this.close();
    void this.router.navigate(searchItemLink(item));
  }

  close(): void {
    this.closed.emit();
  }

  private setActive(index: number): void {
    this.activeIndex.set(index);
    globalThis.document?.getElementById(`global-search-${index}`)?.scrollIntoView?.({ block: 'nearest' });
  }
}
