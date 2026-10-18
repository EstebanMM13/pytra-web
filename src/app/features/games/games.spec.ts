import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router, provideRouter, withViewTransitions } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameService } from '../../core/services/game.service';
import { PsnService } from '../../core/services/psn.service';
import { SteamService } from '../../core/services/steam.service';
import { VIEW_TRANSITION_OPTIONS } from '../../core/view-transitions';
import { Navbar } from '../../shared/navbar/navbar';
import { Games } from './games';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

function game(id: number, genres: { id: number; name: string }[], developer: string): Game {
  return {
    id,
    name: `Game ${id}`,
    developer,
    publisher: null,
    releaseDate: '2020-01-01',
    category: 'SINGLEPLAYER',
    sagaId: null,
    sagaName: null,
    coverImageUrl: null,
    reviewStatus: 'CONFIRMED',
    genres,
    updatedAt: '2026-01-01T00:00:00',
  };
}

const ACTION = { id: 10, name: 'Action' };
const RPG = { id: 20, name: 'RPG' };
const PUZZLE = { id: 30, name: 'Puzzle' };

const GAMES = [
  game(1, [ACTION, RPG, PUZZLE], 'Capcom'),
  game(2, [ACTION, RPG], 'FromSoftware'),
  game(3, [ACTION], 'Nintendo'),
  game(4, [{ id: 40, name: 'Shooter' }], 'Valve'),
];

/** Steam and PSN with nothing pending (the library only reads their pending lists for the banner). */
const NO_PENDING = [
  { provide: SteamService, useValue: { getPending: () => of([]) } },
  { provide: PsnService, useValue: { getPending: () => of([]) } },
];

interface FakeTransition {
  skipped: boolean;
}

type DocumentWithTransitions = { startViewTransition?: unknown };

describe('Games library filters', () => {
  let transitions: FakeTransition[];
  let original: unknown;

  beforeEach(() => {
    // jsdom has no View Transitions API: record each transition the router starts.
    transitions = [];
    const doc = document as unknown as DocumentWithTransitions;
    original = doc.startViewTransition;
    doc.startViewTransition = (update: () => Promise<void>) => {
      const transition = {
        skipped: false,
        skipTransition: () => (transition.skipped = true),
        updateCallbackDone: Promise.resolve(),
        ready: Promise.resolve(),
        finished: Promise.resolve(),
      };
      transitions.push(transition);
      queueMicrotask(() => void update());
      return transition;
    };
  });

  afterEach(() => {
    (document as unknown as DocumentWithTransitions).startViewTransition = original;
  });

  async function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'games', component: Games }], withViewTransitions(VIEW_TRANSITION_OPTIONS)),
        provideTranslateService(),
        { provide: GameService, useValue: { findAll: () => of(GAMES) } },
        ...NO_PENDING,
      ],
    });
    TestBed.overrideComponent(Games, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const harness = await RouterTestingHarness.create('/games');
    const router = TestBed.inject(Router);
    const navigations: string[] = [];
    router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) navigations.push(e.urlAfterRedirects);
    });
    const el = harness.routeNativeElement!;
    el.querySelector<HTMLButtonElement>('app-library-filters button[aria-haspopup="dialog"]')!.click();
    await harness.fixture.whenStable();

    const section = (id: string) => el.querySelector(`#${id}`)!.closest('section')!;
    /** Opens the section's combobox and clicks the option, like a mouse user. */
    async function pick(sectionId: string, label: string): Promise<void> {
      const input = section(sectionId).querySelector<HTMLInputElement>('input[role="combobox"]')!;
      input.focus();
      input.click();
      await harness.fixture.whenStable();
      const option = [...section(sectionId).querySelectorAll<HTMLElement>('[role="option"]')].find(
        (o) => o.textContent?.trim() === label,
      )!;
      option.click();
      await harness.fixture.whenStable();
    }
    const chips = (sectionId: string) =>
      [...section(sectionId).querySelectorAll('[data-combobox-chip]')].map((c) => c.textContent?.trim());
    const listed = () => [...new Set([...el.querySelectorAll('a[href^="/games/"]')].map((a) => a.getAttribute('href')))];
    return { harness, router, navigations, el, pick, chips, listed };
  }

  it('keeps several picked genres in the URL, the panel and the list, with one navigation per pick', async () => {
    const { harness, router, navigations, el, pick, chips, listed } = await setup();

    // Each extra genre narrows the list: games must have every picked genre.
    await pick('library-filter-genres', 'Action');
    expect(listed()).toEqual(['/games/1', '/games/2', '/games/3']);
    await pick('library-filter-genres', 'RPG');
    expect(listed()).toEqual(['/games/1', '/games/2']);
    await pick('library-filter-genres', 'Puzzle');
    await harness.fixture.whenStable();

    expect(router.url).toBe('/games?genre=10,20,30');
    expect(navigations).toEqual(['/games?genre=10', '/games?genre=10,20', '/games?genre=10,20,30']);
    expect(chips('library-filter-genres')).toEqual(['Action', 'RPG', 'Puzzle']);
    expect(listed()).toEqual(['/games/1']);
    // The panel and the open list survive every pick.
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(el.querySelector('[role="listbox"]')).not.toBeNull();
    // Query-only navigations never cross-fade the page: a running transition swallows the next click.
    expect(transitions.length).toBe(3);
    expect(transitions.every((t) => t.skipped)).toBe(true);
  });

  it('keeps several picked developers stable too', async () => {
    const { harness, router, navigations, pick, chips, listed } = await setup();

    await pick('library-filter-developers', 'Capcom');
    await pick('library-filter-developers', 'Valve');
    await harness.fixture.whenStable();

    expect(router.url).toBe('/games?dev=Capcom&dev=Valve');
    expect(navigations).toEqual(['/games?dev=Capcom', '/games?dev=Capcom&dev=Valve']);
    expect(chips('library-filter-developers')).toEqual(['Capcom', 'Valve']);
    expect(listed()).toEqual(['/games/1', '/games/4']);
    expect(transitions.length).toBe(2);
    expect(transitions.every((t) => t.skipped)).toBe(true);
  });
});

describe('Games library search', () => {
  async function setup() {
    /** Lets a test cancel navigations (the guard reruns on query-only changes). */
    const guard = { allow: true };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'games', component: Games, canActivate: [() => guard.allow], runGuardsAndResolvers: 'always' },
        ]),
        provideTranslateService(),
        { provide: GameService, useValue: { findAll: () => of(GAMES) } },
        ...NO_PENDING,
      ],
    });
    TestBed.overrideComponent(Games, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const harness = await RouterTestingHarness.create('/games');
    const router = TestBed.inject(Router);
    const navigations: string[] = [];
    router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) navigations.push(e.urlAfterRedirects);
    });
    const el = harness.routeNativeElement!;
    const input = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    const type = async (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
      await harness.fixture.whenStable();
    };
    const listed = () => [...new Set([...el.querySelectorAll('a[href^="/games/"]')].map((a) => a.getAttribute('href')))];
    const pause = async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await harness.fixture.whenStable();
    };
    return { harness, router, navigations, el, input, type, listed, pause, guard };
  }

  it('filters on every keystroke but writes the URL once typing pauses', async () => {
    const { router, navigations, type, listed, pause } = await setup();

    await type('G');
    await type('Game');
    await type('Game 2');
    expect(listed()).toEqual(['/games/2']);
    expect(navigations).toEqual([]);

    await pause();
    expect(navigations).toEqual(['/games?q=Game%202']);
    expect(router.url).toBe('/games?q=Game%202');
    expect(listed()).toEqual(['/games/2']);
  });

  it('shows a search text changed from outside (back / forward, links) in the box', async () => {
    const { harness, router, input, listed } = await setup();

    await router.navigateByUrl('/games?q=Game%203');
    await harness.fixture.whenStable();

    expect(input.value).toBe('Game 3');
    expect(listed()).toEqual(['/games/3']);
  });

  it('carries a pending search into the next filter change instead of losing it', async () => {
    const { harness, router, navigations, type, el, pause } = await setup();

    await type('Game 1');
    el.querySelector<HTMLButtonElement>('[aria-label="library.statusLabel"] button[aria-checked="false"]')!.click();
    await harness.fixture.whenStable();
    await pause();

    expect(navigations.length).toBe(1);
    expect(router.url).toContain('q=Game%201');
    expect(router.url).toContain('status=');
  });

  it('never writes the URL after the page is destroyed mid-debounce', async () => {
    const { harness, navigations, type, pause } = await setup();

    await type('Game 2');
    harness.fixture.destroy();
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(navigations).toEqual([]);
  });

  it('shows the whole library again when the box is cleared while a URL write is pending', async () => {
    const { router, navigations, type, listed, pause } = await setup();

    await type('Game 2');
    await type('');
    expect(listed()).toEqual(['/games/1', '/games/2', '/games/3', '/games/4']);

    await pause();
    expect(navigations).toEqual([]);
    expect(router.url).toBe('/games');
    expect(listed()).toEqual(['/games/1', '/games/2', '/games/3', '/games/4']);
  });

  it('lets a later back / forward to the same text reach the box after a cancelled search navigation', async () => {
    const { harness, router, navigations, input, type, listed, pause, guard } = await setup();

    guard.allow = false;
    await type('Game 2');
    await pause();
    expect(navigations).toEqual([]);
    expect(router.url).toBe('/games');

    // Typing again (still pending), then the URL moves to the text of the cancelled write.
    guard.allow = true;
    await type('Game 4');
    await router.navigateByUrl('/games?q=Game%202');
    await harness.fixture.whenStable();

    expect(input.value).toBe('Game 2');
    expect(listed()).toEqual(['/games/2']);
    await pause();
    expect(router.url).toBe('/games?q=Game%202');
  });
});

describe('Games library pending banner', () => {
  const pending = (id: number): Game => ({ ...game(id, [], 'Studio'), reviewStatus: 'PENDING_REVIEW' });

  async function setup(steamIds: number[], psnIds: number[]) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'games', component: Games }]),
        provideTranslateService(),
        { provide: GameService, useValue: { findAll: () => of([...GAMES, pending(101), pending(102)]) } },
        { provide: SteamService, useValue: { getPending: () => of(steamIds.map(pending)) } },
        { provide: PsnService, useValue: { getPending: () => of(psnIds.map(pending)) } },
      ],
    });
    TestBed.overrideComponent(Games, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const harness = await RouterTestingHarness.create('/games');
    return harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a[href="/sync"]');
  }

  it('names Steam when every pending game came from Steam, linking to /sync', async () => {
    const banner = await setup([101, 102], []);
    expect(banner?.textContent).toContain('library.pendingSteam');
  });

  it('names PlayStation when every pending game came from PSN', async () => {
    const banner = await setup([], [101, 102]);
    expect(banner?.textContent).toContain('library.pendingPsn');
  });

  it('uses neutral copy when the pending games came from both', async () => {
    const banner = await setup([101], [102]);
    expect(banner?.textContent).toContain('library.pendingMixed');
  });
});
