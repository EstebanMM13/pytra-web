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
import { LucideSearch, LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Game } from '../../core/models/game.model';
import { GameService } from '../../core/services/game.service';

const MAX_RESULTS = 8;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Global game search (Ctrl/⌘+K): filters the user's games, Enter opens the highlighted one. */
@Component({
  selector: 'app-game-search',
  imports: [TranslatePipe, LucideSearch, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-search.html',
  host: { '(document:keydown.escape)': 'close()' },
})
export class GameSearch {
  private readonly gameService = inject(GameService);
  private readonly router = inject(Router);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  readonly closed = output<void>();

  protected readonly games = signal<Game[] | null>(null);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);

  protected readonly results = computed(() => {
    const games = this.games() ?? [];
    const query = normalize(this.query().trim());
    const matches = query ? games.filter((g) => normalize(g.name).includes(query)) : games;
    return matches.slice(0, MAX_RESULTS);
  });

  constructor() {
    this.gameService.findAll().subscribe({
      next: (games) => this.games.set([...games].sort((a, b) => a.name.localeCompare(b.name))),
      error: () => this.games.set([]),
    });
    afterNextRender(() => this.input().nativeElement.focus());
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      this.activeIndex.update((i) => (i + 1) % count);
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      this.activeIndex.update((i) => (i - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const game = this.results()[this.activeIndex()];
      if (game) {
        this.open(game);
      }
    }
  }

  protected open(game: Game): void {
    this.close();
    this.router.navigate(['/games', game.id]);
  }

  close(): void {
    this.closed.emit();
  }
}
