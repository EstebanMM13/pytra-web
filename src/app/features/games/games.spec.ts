import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router, provideRouter, withViewTransitions } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameService } from '../../core/services/game.service';
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

const GAMES = [
  game(1, [{ id: 10, name: 'Action' }], 'Capcom'),
  game(2, [{ id: 20, name: 'RPG' }], 'FromSoftware'),
  game(3, [{ id: 30, name: 'Puzzle' }], 'Nintendo'),
  game(4, [{ id: 40, name: 'Shooter' }], 'Valve'),
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

    await pick('library-filter-genres', 'Action');
    await pick('library-filter-genres', 'RPG');
    await pick('library-filter-genres', 'Puzzle');
    await harness.fixture.whenStable();

    expect(router.url).toBe('/games?genre=10,20,30');
    expect(navigations).toEqual(['/games?genre=10', '/games?genre=10,20', '/games?genre=10,20,30']);
    expect(chips('library-filter-genres')).toEqual(['Action', 'RPG', 'Puzzle']);
    expect(listed()).toEqual(['/games/1', '/games/2', '/games/3']);
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
