import { DiaryService } from '../../../core/services/diary.service';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { EMPTY, Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Game, GameCategory } from '../../../core/models/game.model';
import { DemoModeService } from '../../../core/services/demo-mode.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import { UserDataCache } from '../../../core/services/user-data-cache';
import { OnlinePlaytimeService } from '../../../core/services/online-playtime.service';
import { PlatformService } from '../../../core/services/platform.service';
import { PREFERENCES_KEY } from '../../../core/services/preferences.service';
import { RunFormLauncher } from '../../../core/services/run-form-launcher.service';
import { Navbar } from '../../../shared/navbar/navbar';
import { ToastService } from '../../../shared/toast/toast.service';
import { GameDetail } from './game-detail';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

function game(category: GameCategory, releaseDate: string | null = '2020-01-01'): Game {
  return {
    id: 7,
    name: 'Test Game',
    developer: 'Studio',
    publisher: null,
    releaseDate,
    category,
    sagaId: null,
    sagaName: null,
    coverImageUrl: null,
    reviewStatus: 'CONFIRMED',
    genres: [],
    updatedAt: '2026-01-01T00:00:00',
  };
}

describe('GameDetail', () => {
  const launcher = { saved$: EMPTY, openNewRun: vi.fn() };
  let blockWrite: ReturnType<typeof vi.fn>;

  function setup(g: Game, demo = false) {
    launcher.openNewRun.mockClear();
    blockWrite = vi.fn(() => demo);
    TestBed.configureTestingModule({
      imports: [GameDetail],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: String(g.id) })) } },
        { provide: GameService, useValue: { cachedById: () => null, findById: () => of(g), findAll: () => of([g]) } },
        { provide: ExperienceService, useValue: { findAllByGame: () => of([]) } },
        { provide: DiaryService, useValue: { findByGame: () => of([]) } },
        {
          provide: OnlinePlaytimeService,
          useValue: { findByGame: () => throwError(() => new HttpErrorResponse({ status: 404 })) },
        },
        { provide: PlatformService, useValue: { platforms: signal([]), load: () => of([]) } },
        { provide: RunFormLauncher, useValue: launcher },
        { provide: DemoModeService, useValue: { isDemo: signal(demo), blockWrite } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(GameDetail, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(GameDetail);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = (label: string) =>
      [...el.querySelectorAll('button')].filter(
        (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
      );
    return { fixture, el, buttons };
  }

  it('lights up the Platinum tile only when the game has a platinum, never in the header', () => {
    expect(setup(game('SINGLEPLAYER')).el.querySelector('[data-stat="platinum"]')).toBeNull();
    TestBed.resetTestingModule();
    const { el } = setup({ ...game('SINGLEPLAYER'), hasPlatinum: true });
    const tile = el.querySelector('[data-stat="platinum"]')!;
    expect(tile.classList).toContain('platinum-tile');
    expect(tile.textContent).toContain('game.stats.platinum');
    expect(el.querySelector('h1')!.parentElement!.querySelector('.platinum-pill')).toBeNull();
  });

  it('gives the hero text a background-colour halo only over a cover backdrop', () => {
    const plain = setup(game('SINGLEPLAYER')).el;
    expect(plain.querySelector('h1')!.closest('.cover-legible')).toBeNull();
    TestBed.resetTestingModule();

    const { el } = setup({ ...game('SINGLEPLAYER'), coverImageUrl: 'https://img.example/cover.jpg' });
    const legible = el.querySelector('h1')!.closest('.cover-legible')!;
    expect(legible).not.toBeNull();
    expect(legible.querySelector('dl')).not.toBeNull();
  });

  it('lights up the 100% tile on its own, independent of the platinum', () => {
    const none = setup(game('SINGLEPLAYER')).el;
    expect(none.querySelector('[data-stat="fullCompletion"]')).toBeNull();
    expect(none.textContent).toContain('game.stats.fullCompletion');
    TestBed.resetTestingModule();

    const { el } = setup({ ...game('SINGLEPLAYER'), hasFullCompletion: true });
    const tile = el.querySelector('[data-stat="fullCompletion"]')!;
    expect(tile.classList).toContain('completion-tile');
    expect(tile.textContent).toContain('game.stats.fullCompletion');
    expect(tile.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('run.fullCompletionAria');
    expect(el.querySelector('[data-stat="platinum"]')).toBeNull();
    TestBed.resetTestingModule();

    const both = setup({ ...game('SINGLEPLAYER'), hasPlatinum: true, hasFullCompletion: true }).el;
    expect(both.querySelector('[data-stat="platinum"]')).not.toBeNull();
    expect(both.querySelector('[data-stat="fullCompletion"]')).not.toBeNull();
    // The 100% tile comes before the platinum one (left of it in the phone grid)
    const order = both.querySelector('[data-stat="fullCompletion"]')!.compareDocumentPosition(both.querySelector('[data-stat="platinum"]')!);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers edit, new run and the first-run link to a signed-in user', () => {
    const { buttons } = setup(game('SINGLEPLAYER'));
    expect(buttons('game.editAria').length).toBe(1);
    expect(buttons('game.edit').length).toBe(1);
    // One "Nueva partida", in the runs section header (not in the hero or the mobile top bar).
    expect(buttons('game.newRun').length).toBe(1);
    expect(buttons('game.newRun')[0].closest('app-section-header')).not.toBeNull();
    expect(buttons('game.newRun')[0].closest('section')?.textContent).toContain('game.runs');
    buttons('game.newRun')[0].click();
    expect(launcher.openNewRun).toHaveBeenCalledWith(7);
    launcher.openNewRun.mockClear();
    expect(buttons('game.firstRun').length).toBe(1);
    buttons('game.firstRun')[0].click();
    expect(launcher.openNewRun).toHaveBeenCalledWith(7);
  });

  it('shows every edit and run entry point in the demo too, so it can be explored', () => {
    const { buttons } = setup(game('SINGLEPLAYER'), true);
    expect(buttons('game.editAria').length).toBe(1);
    expect(buttons('game.edit').length).toBe(1);
    expect(buttons('game.firstRun').length).toBe(1);
    buttons('game.newRun')[0].click();
    // The form opens; only its save is stopped (ModalSheet), so nothing is blocked here.
    expect(launcher.openNewRun).toHaveBeenCalledWith(7);
    expect(blockWrite).not.toHaveBeenCalled();
  });

  it('gives ONLINE games no way to add a run', () => {
    const { buttons, el } = setup(game('ONLINE'));
    expect(buttons('game.newRun')).toEqual([]);
    expect(buttons('game.firstRun')).toEqual([]);
    expect(buttons('game.edit').length).toBe(1);
    expect(el.textContent).toContain('game.onlineNoRuns');
  });

  it('shows the coming-soon badge only for unreleased games', () => {
    expect(setup(game('SINGLEPLAYER', '2999-01-01')).el.querySelector('app-upcoming-badge')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(setup(game('SINGLEPLAYER', '2020-01-01')).el.querySelector('app-upcoming-badge')).toBeNull();
  });
});

describe('GameDetail stats', () => {
  function render(category: GameCategory, generalRating: number | null = null, flags: object = {}) {
    TestBed.configureTestingModule({
      imports: [GameDetail],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } },
        { provide: GameService, useValue: { cachedById: () => null, findById: () => of(game(category)), findAll: () => of([]) } },
        { provide: ExperienceService, useValue: { findAllByGame: () => of([]) } },
        { provide: DiaryService, useValue: { findByGame: () => of([]) } },
        {
          provide: OnlinePlaytimeService,
          useValue: { findByGame: () => of({ gameId: 7, totalHours: 20, generalRating, platforms: [], ...flags }) },
        },
        { provide: PlatformService, useValue: { platforms: signal([]), load: () => of([]) } },
        { provide: RunFormLauncher, useValue: { saved$: EMPTY, openNewRun: vi.fn() } },
        { provide: DemoModeService, useValue: { isDemo: signal(false), blockWrite: () => false } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(GameDetail, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(GameDetail);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('features total hours with the campaign / online split for games with online hours', () => {
    const hours = render('HYBRID').querySelector('[data-stat="hours"]')!;
    expect(hours.textContent).toContain('20 h');
    const breakdown = hours.querySelector('[data-hours-breakdown]')!;
    expect(breakdown.textContent).toContain('game.stats.campaign');
    expect(breakdown.textContent).toContain('game.stats.online');
    // Compact: one thin bar and a two-line legend beside the figure.
    expect(breakdown.querySelectorAll('li').length).toBe(2);
  });

  it('labels the online card as the online data, saved with one "save" button', () => {
    const el = render('HYBRID');
    expect(el.textContent).toContain('game.online.title');
    const submit = el.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
    // An existing record keeps the same "save" label (no separate "update").
    expect(submit.textContent!.trim()).toBe('game.online.save');
  });

  it('widens the hybrid hours card and keeps the other cards in even rows', () => {
    const el = render('HYBRID');
    const hours = el.querySelector('[data-stat="hours"]')!;
    const grid = hours.parentElement!;
    expect(grid.className).toContain('grid-cols-6');
    expect(grid.className).toContain('md:grid-cols-12');
    expect(grid.className).toContain('xl:grid-cols-7');
    // Phones: hours alone (6 of 6), runs / average / best three across (2 each), 100% / platinum two across (3 each).
    const spans = [...grid.children].map((c) => c.className.match(/(?:^| )col-span-(\d+)/)?.[1]);
    expect(spans).toEqual(['6', '2', '2', '2', '3', '3']);
    // Tablets: hours + runs + average (6 + 3 + 3 of 12), then best / 100% / platinum (4 each).
    const mdSpans = [...grid.children].map((c) => c.className.match(/md:col-span-(\d+)/)?.[1] ?? null);
    expect(mdSpans).toEqual([null, '3', '3', '4', '4', '4']);
    // Wide screens: one row of seven cells, hours two wide.
    expect(hours.className).toContain('xl:col-span-2');
  });

  it('shows six equal cards (hours as a regular card) and no split for single-player games', () => {
    const el = render('SINGLEPLAYER');
    const hours = el.querySelector('[data-stat="hours"]')!;
    expect(hours.textContent).not.toContain('game.stats.online');
    expect(hours.className).not.toContain('col-span');
    expect(el.querySelectorAll('app-stat-card').length).toBe(5);
    expect(hours.parentElement!.children.length).toBe(6);
    expect(hours.parentElement!.className).toContain('lg:grid-cols-6');
  });

  it('shows total hours, the online rating, 100% and platinum for ONLINE games, two by two on phones', () => {
    const el = render('ONLINE', 8);
    const hours = el.querySelector('[data-stat="hours"]')!;
    const grid = hours.parentElement!;
    expect(grid.children.length).toBe(4);
    expect(grid.className).toContain('grid-cols-2');
    expect(grid.className).toContain('md:grid-cols-4');
    expect(hours.className).not.toContain('col-span');
    const labels = [...grid.children].map((c) => c.textContent);
    expect(labels[1]).toContain('game.stats.rating');
    expect(labels[1]).toContain('8');
    expect(labels[2]).toContain('game.stats.fullCompletion');
    expect(labels[3]).toContain('game.stats.platinum');
    // Not earned: plain cards, not the lit tiles.
    expect(el.querySelector('[data-stat="platinum"]')).toBeNull();
    expect(el.querySelector('[data-stat="fullCompletion"]')).toBeNull();
    expect(hours.textContent).toContain('20 h');
    // No runs: no campaign / online split.
    expect(hours.textContent).not.toContain('game.stats.campaign');
    expect(el.textContent).not.toContain('game.stats.bestRating');
    expect(el.textContent).not.toContain('game.stats.runs');
  });

  it('lights the 100% and platinum tiles from the online playtime of an ONLINE game', () => {
    const el = render('ONLINE', null, { platinum: true, fullCompletion: true });
    expect(el.querySelector('[data-stat="platinum"]')!.classList).toContain('platinum-tile');
    expect(el.querySelector('[data-stat="fullCompletion"]')!.classList).toContain('completion-tile');
    // And the badges by the online card's hours.
    expect(el.querySelector('[data-online-platinum]')).not.toBeNull();
    expect(el.querySelector('[data-online-full-completion]')).not.toBeNull();
  });

  it('lights a hybrid game tile when only the online playtime has the flag', () => {
    const el = render('HYBRID', null, { fullCompletion: true });
    expect(el.querySelector('[data-stat="fullCompletion"]')).not.toBeNull();
    expect(el.querySelector('[data-stat="platinum"]')).toBeNull();
    expect(el.querySelector('[data-stat="hours"]')!.parentElement!.children.length).toBe(6);
    expect(el.querySelector('[data-online-platinum]')).toBeNull();
  });

  it('reserves the saga line so the title does not move without a saga', () => {
    const line = render('SINGLEPLAYER').querySelector('[data-saga-line]')!;
    expect(line.tagName).toBe('SPAN');
    expect(line.getAttribute('aria-hidden')).toBe('true');
    expect(line.nextElementSibling?.tagName).toBe('H1');
  });
});

describe('GameDetail online rating', () => {
  afterEach(() => localStorage.clear());

  function render(scale: string, generalRating: number | null) {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ratingScale: scale }));
    const upsert = vi.fn((_id: number, body: unknown) => of({ gameId: 7, platforms: [], ...(body as object) }));
    TestBed.configureTestingModule({
      imports: [GameDetail],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } },
        { provide: GameService, useValue: { cachedById: () => null, findById: () => of(game('HYBRID')), findAll: () => of([]) } },
        { provide: ExperienceService, useValue: { findAllByGame: () => of([]) } },
        { provide: DiaryService, useValue: { findByGame: () => of([]) } },
        {
          provide: OnlinePlaytimeService,
          useValue: { findByGame: () => of({ gameId: 7, totalHours: 20, generalRating, platforms: [] }), upsert },
        },
        { provide: PlatformService, useValue: { platforms: signal([]), load: () => of([]) } },
        { provide: RunFormLauncher, useValue: { saved$: EMPTY, openNewRun: vi.fn() } },
        { provide: DemoModeService, useValue: { isDemo: signal(false), blockWrite: () => false } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(GameDetail, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(GameDetail);
    fixture.detectChanges();
    const detail = fixture.componentInstance;
    return { detail, form: detail.onlinePlaytimeForm, upsert, submit: () => detail['submitOnlinePlaytime']() };
  }

  it('shows the stored rating on the scale and saves typed values on 0–10', () => {
    const { form, upsert, submit } = render('100', 8.75);
    const rating = form.controls.generalRating;
    expect(rating.value).toBe('87,5');
    expect(rating.valid).toBe(true);

    rating.setValue('101');
    expect(rating.valid).toBe(false);

    rating.setValue('93');
    submit();
    expect(upsert).toHaveBeenCalledWith(7, expect.objectContaining({ generalRating: 9.3 }));
  });

  it('accepts decimals on 0–5 with the default precision', () => {
    const { form, upsert, submit } = render('5', null);
    form.controls.generalRating.setValue('4,25');
    expect(form.controls.generalRating.valid).toBe(true);
    submit();
    expect(upsert).toHaveBeenCalledWith(7, expect.objectContaining({ generalRating: 8.5 }));
  });
});

describe('GameDetail loading', () => {
  function setup(cached: Game | null = null) {
    const game$ = new Subject<Game>();
    const findByGame = vi.fn(() => of({ gameId: 7, totalHours: 20, generalRating: null, platforms: [] }));
    const loadPlatforms = vi.fn(() => of([]));
    TestBed.configureTestingModule({
      imports: [GameDetail],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } },
        { provide: GameService, useValue: { cachedById: () => cached, findById: () => game$, findAll: () => of([]) } },
        { provide: ExperienceService, useValue: { findAllByGame: () => of([]) } },
        { provide: DiaryService, useValue: { findByGame: () => of([]) } },
        { provide: OnlinePlaytimeService, useValue: { findByGame } },
        { provide: PlatformService, useValue: { platforms: signal([]), load: loadPlatforms } },
        { provide: RunFormLauncher, useValue: { saved$: EMPTY, openNewRun: vi.fn() } },
        { provide: DemoModeService, useValue: { isDemo: signal(false), blockWrite: () => false } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(GameDetail, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(GameDetail);
    fixture.detectChanges();
    return { fixture, game$, findByGame, loadPlatforms };
  }

  it('requests the online playtime and the platform catalog alongside the game, once', () => {
    const { fixture, game$, findByGame, loadPlatforms } = setup();
    expect(findByGame).toHaveBeenCalledExactlyOnceWith(7);
    expect(loadPlatforms).toHaveBeenCalled();

    game$.next(game('HYBRID'));
    fixture.detectChanges();
    expect(findByGame).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('20');
  });

  it('renders the cached game at once, then refreshes it without reloading the online card', () => {
    const { fixture, game$, findByGame } = setup({ ...game('HYBRID'), name: 'Cached Name' });
    expect(fixture.nativeElement.textContent).toContain('Cached Name');
    expect(findByGame).toHaveBeenCalledTimes(1);

    game$.next({ ...game('HYBRID'), name: 'Fresh Name' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fresh Name');
    expect(findByGame).toHaveBeenCalledTimes(1);
  });

  it('ignores a refresh that answers after a local save (no stale data, online card kept)', () => {
    const { fixture, game$, findByGame } = setup({ ...game('HYBRID'), name: 'Cached Name' });
    const saved = { ...game('SINGLEPLAYER'), name: 'Saved Name' };
    fixture.componentInstance['onGameSaved'](saved);
    fixture.detectChanges();
    const callsAfterSave = findByGame.mock.calls.length;

    game$.next({ ...game('HYBRID'), name: 'Old Server Name' });
    fixture.detectChanges();
    expect(fixture.componentInstance.game()).toEqual(saved);
    expect(fixture.nativeElement.textContent).toContain('Saved Name');
    expect(findByGame).toHaveBeenCalledTimes(callsAfterSave);
  });

  it('keeps the cached game when the refresh fails, but drops it when the game is gone', () => {
    const { fixture, game$ } = setup(game('SINGLEPLAYER'));
    game$.error(new HttpErrorResponse({ status: 500 }));
    fixture.detectChanges();
    expect(fixture.componentInstance.game()).not.toBeNull();
    TestBed.resetTestingModule();

    const gone = setup(game('SINGLEPLAYER'));
    const invalidateAll = vi.spyOn(TestBed.inject(UserDataCache), 'invalidateAll');
    gone.game$.error(new HttpErrorResponse({ status: 404 }));
    expect(invalidateAll).toHaveBeenCalled();
    gone.fixture.detectChanges();
    expect(gone.fixture.componentInstance.game()).toBeNull();
    expect(gone.fixture.componentInstance.loadError()).toBe(true);
  });

  it('ignores the prefetched online playtime of a SINGLEPLAYER game', () => {
    const { fixture, game$ } = setup();
    game$.next(game('SINGLEPLAYER'));
    fixture.detectChanges();
    expect(fixture.componentInstance.onlinePlaytime()).toBeNull();
  });
});

describe('GameDetail hero', () => {
  const IGDB_COVER = 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg';

  function render(g: Game) {
    TestBed.configureTestingModule({
      imports: [GameDetail],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: String(g.id) })) } },
        { provide: GameService, useValue: { cachedById: () => null, findById: () => of(g), findAll: () => of([g]) } },
        { provide: ExperienceService, useValue: { findAllByGame: () => of([]) } },
        { provide: DiaryService, useValue: { findByGame: () => of([]) } },
        {
          provide: OnlinePlaytimeService,
          useValue: { findByGame: () => throwError(() => new HttpErrorResponse({ status: 404 })) },
        },
        { provide: PlatformService, useValue: { platforms: signal([]), load: () => of([]) } },
        { provide: RunFormLauncher, useValue: { saved$: EMPTY, openNewRun: vi.fn() } },
        { provide: DemoModeService, useValue: { isDemo: signal(false), blockWrite: () => false } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(GameDetail, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(GameDetail);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  /** Lays the h1 out as clamped (content taller than its box) or not; jsdom has no layout. */
  function clampTitle(cut: boolean) {
    const proto = HTMLHeadingElement.prototype;
    vi.spyOn(proto, 'scrollHeight', 'get').mockReturnValue(cut ? 120 : 80);
    vi.spyOn(proto, 'clientHeight', 'get').mockReturnValue(80);
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('app-cover-viewer').forEach((v) => v.remove());
  });

  it('keeps a title that fits as plain text: no button semantics and nothing to toggle', async () => {
    clampTitle(false);
    const { fixture, el } = render(game('SINGLEPLAYER'));
    await fixture.whenStable();
    fixture.detectChanges();
    const h1 = el.querySelector('h1')!;
    const text = h1.querySelector('[data-title-text]')!;
    expect(text.getAttribute('role')).toBeNull();
    expect(text.getAttribute('tabindex')).toBeNull();
    expect(text.getAttribute('aria-expanded')).toBeNull();
    expect(h1.classList).not.toContain('cursor-pointer');
    h1.click();
    fixture.detectChanges();
    expect(h1.classList).not.toContain('line-clamp-none!');
  });

  it('lets a clamped title expand to its full text and fold back, by tap or keyboard', async () => {
    clampTitle(true);
    const { fixture, el } = render(game('SINGLEPLAYER'));
    await fixture.whenStable();
    fixture.detectChanges();
    const h1 = el.querySelector('h1')!;
    const text = h1.querySelector<HTMLElement>('[data-title-text]')!;
    expect(text.getAttribute('role')).toBe('button');
    expect(text.getAttribute('tabindex')).toBe('0');
    expect(text.getAttribute('aria-expanded')).toBe('false');
    expect(h1.classList).toContain('cursor-pointer');

    text.click();
    fixture.detectChanges();
    expect(h1.classList).toContain('line-clamp-none!');
    expect(text.getAttribute('aria-expanded')).toBe('true');

    text.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(h1.classList).not.toContain('line-clamp-none!');
    expect(text.getAttribute('aria-expanded')).toBe('false');
  });

  it('has no cover viewer for a game without a cover', () => {
    const { el } = render(game('SINGLEPLAYER'));
    expect(el.querySelector('[data-cover-open]')).toBeNull();
    expect(el.querySelector('app-game-cover')).not.toBeNull();
  });

  it('opens the cover fullscreen at a larger size and closes it on Escape, restoring focus', async () => {
    const { fixture, el } = render({ ...game('SINGLEPLAYER'), coverImageUrl: IGDB_COVER });
    const opener = el.querySelector<HTMLButtonElement>('[data-cover-open]')!;
    expect(opener.getAttribute('aria-label')).toBe('game.viewCover');
    opener.focus();
    opener.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = document.querySelector<HTMLElement>('[data-cover-viewer]')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const sources = [...dialog.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(sources).toEqual([IGDB_COVER, 'https://images.igdb.com/igdb/image/upload/t_1080p/co1abc.jpg']);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('common.close');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(document.querySelector('[data-cover-viewer]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('closes the cover viewer on a tap anywhere', async () => {
    const { fixture, el } = render({ ...game('SINGLEPLAYER'), coverImageUrl: IGDB_COVER });
    el.querySelector<HTMLButtonElement>('[data-cover-open]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    document.querySelector<HTMLElement>('[data-cover-viewer] img')!.click();
    fixture.detectChanges();
    expect(document.querySelector('[data-cover-viewer]')).toBeNull();
  });
});

describe('GameDetail online platinum / 100%', () => {
  function render(stored: object | null, demo = false) {
    const upsert = vi.fn((_id: number, body: unknown) => of({ id: 1, gameId: 7, platforms: [], ...(body as object) }));
    const findByGame = stored
      ? () => of({ id: 1, gameId: 7, totalHours: 20, generalRating: null, platforms: [], ...stored })
      : () => throwError(() => new HttpErrorResponse({ status: 404 }));
    TestBed.configureTestingModule({
      imports: [GameDetail],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } },
        { provide: GameService, useValue: { cachedById: () => null, findById: () => of(game('ONLINE')), findAll: () => of([]) } },
        { provide: ExperienceService, useValue: { findAllByGame: () => of([]) } },
        { provide: DiaryService, useValue: { findByGame: () => of([]) } },
        { provide: OnlinePlaytimeService, useValue: { findByGame, upsert } },
        { provide: PlatformService, useValue: { platforms: signal([]), load: () => of([]) } },
        { provide: RunFormLauncher, useValue: { saved$: EMPTY, openNewRun: vi.fn() } },
        { provide: DemoModeService, useValue: { isDemo: signal(demo), blockWrite: () => false } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(GameDetail, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(GameDetail);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = (flag: string) => {
      (el.querySelector(`[data-online-switch="${flag}"]`) as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    return { fixture, el, upsert, toggle, detail: fixture.componentInstance };
  }

  it('shows the stored flags on the switches', () => {
    const { el } = render({ fullCompletion: true });
    expect(el.querySelector('[data-online-switch="fullCompletion"]')!.getAttribute('aria-checked')).toBe('true');
    expect(el.querySelector('[data-online-switch="platinum"]')!.getAttribute('aria-checked')).toBe('false');
  });

  it('shows a row per platform plus the unassigned hours, and saves their sum as the total', () => {
    const platforms = [
      { id: 2, name: 'PC', color: null },
      { id: 5, name: 'PS5', color: null },
    ];
    const { el, fixture, upsert } = render({ totalHours: 20, platforms, platformHours: { '2': 5 } });
    const inputs = el.querySelectorAll<HTMLInputElement>('[data-online-platform-hours] input');
    // PC, PS5 and the 15 h on no platform.
    expect([...inputs].map((i) => i.value)).toEqual(['5', '', '15']);

    inputs[1].value = '12';
    inputs[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el.querySelector('form button[type="submit"]') as HTMLButtonElement).click();
    expect(upsert).toHaveBeenCalledWith(7, expect.objectContaining({ totalHours: 32, platformHours: { 2: 5, 5: 12 } }));
  });

  it('shows a single platform as a row too, its hours being the total', () => {
    const { el, fixture, upsert } = render({
      totalHours: 20,
      platforms: [{ id: 2, name: 'PC', color: null }],
      platformHours: { '2': 20 },
    });
    const inputs = el.querySelectorAll<HTMLInputElement>('[data-online-platform-hours] input');
    expect(inputs.length).toBe(1);
    inputs[0].value = '25';
    inputs[0].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el.querySelector('form button[type="submit"]') as HTMLButtonElement).click();
    expect(upsert).toHaveBeenCalledWith(7, expect.objectContaining({ totalHours: 25, platformHours: { 2: 25 } }));
  });

  it('saves a switch right away with the stored hours, and lights the tile', () => {
    const { el, upsert, toggle } = render({ totalHours: 120, platforms: [{ id: 2, name: 'PC', color: null }] });
    toggle('fullCompletion');
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ totalHours: 120, platformIds: [2], platinum: false, fullCompletion: true }),
    );
    expect(el.querySelector('[data-stat="fullCompletion"]')).not.toBeNull();
    expect(el.querySelector('[data-online-full-completion]')).not.toBeNull();

    toggle('fullCompletion');
    expect(upsert).toHaveBeenLastCalledWith(7, expect.objectContaining({ fullCompletion: false }));
    // The game's aggregate is refreshed too, so the tile goes dark again.
    expect(el.querySelector('[data-stat="fullCompletion"]')).toBeNull();
  });

  it('keeps switches pending without a record and sends them with the first save', () => {
    const { el, upsert, toggle, detail } = render(null);
    toggle('platinum');
    expect(upsert).not.toHaveBeenCalled();
    expect(el.textContent).toContain('game.online.platformsPending');

    detail['submitOnlinePlaytime']();
    expect(upsert).toHaveBeenCalledWith(7, expect.objectContaining({ platinum: true, fullCompletion: false }));
  });

  it('reverts a switch whose save fails', () => {
    const { el, upsert, toggle } = render({});
    upsert.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    toggle('platinum');
    expect(el.querySelector('[data-online-switch="platinum"]')!.getAttribute('aria-checked')).toBe('false');
  });
});
