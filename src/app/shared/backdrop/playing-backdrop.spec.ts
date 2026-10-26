import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/api-base-url';
import { Game } from '../../core/models/game.model';
import { GameService } from '../../core/services/game.service';
import { TokenStorageService } from '../../core/services/token-storage.service';
import { UserDataCache } from '../../core/services/user-data-cache';
import { PlayingBackdrop } from './playing-backdrop';

const gamesUrl = `${API_BASE_URL}/games`;
const token = `h.${btoa(JSON.stringify({ sub: 'ana' }))}.s`;
const cover = (id: number) => `https://images.igdb.com/igdb/image/upload/t_cover_big/c${id}.jpg`;

const playing = (id: number, overrides: Partial<Game> = {}): Game =>
  ({
    id,
    name: `Game ${id}`,
    reviewStatus: 'CONFIRMED',
    lastExperienceStatus: 'EN_CURSO',
    lastActivityAt: `2026-01-0${id}`,
    coverImageUrl: cover(id),
    ...overrides,
  }) as Game;

describe('PlayingBackdrop', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(TokenStorageService).setToken(token);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  function create(): ComponentFixture<PlayingBackdrop> {
    const fixture = TestBed.createComponent(PlayingBackdrop);
    fixture.detectChanges();
    return fixture;
  }

  const strips = (fixture: ComponentFixture<PlayingBackdrop>): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-backdrop-strip]'));

  /** Loads the library the way a screen would, before the backdrop mounts. */
  function cacheLibrary(games: Game[]): void {
    TestBed.inject(GameService).findAll().subscribe();
    http.expectOne(gamesUrl).flush(games);
  }

  it('renders one strip per in-progress game, most recent first, from the cached list', () => {
    cacheLibrary([playing(1), playing(3), playing(2, { lastExperienceStatus: 'COMPLETADO' })]);
    const fixture = create();
    http.expectNone(gamesUrl);

    const rendered = strips(fixture);
    expect(rendered).toHaveLength(2);
    expect(rendered.map((s) => s.style.getPropertyValue('--i'))).toEqual(['0', '1']);
    expect(rendered[0].querySelector('img')!.getAttribute('src')).toContain('t_cover_small/c3.jpg');
    expect(rendered[1].querySelector('img')!.getAttribute('src')).toContain('t_cover_small/c1.jpg');
    expect(fixture.nativeElement.style.getPropertyValue('--n')).toBe('2');
  });

  it('caps the strips at 5', () => {
    cacheLibrary([1, 2, 3, 4, 5, 6, 7].map((id) => playing(id)));
    expect(strips(create())).toHaveLength(5);
  });

  it('renders nothing without in-progress games, so the aura shows', () => {
    cacheLibrary([playing(1, { lastExperienceStatus: 'COMPLETADO' })]);
    expect(strips(create())).toHaveLength(0);
  });

  it('loads the library itself when no screen has', () => {
    const fixture = create();
    http.expectOne(gamesUrl).flush([playing(1)]);
    fixture.detectChanges();
    expect(strips(fixture)).toHaveLength(1);
  });

  it('fades a strip in once its cover loads', () => {
    cacheLibrary([playing(1)]);
    const fixture = create();
    const [strip] = strips(fixture);
    expect(strip.classList).not.toContain('shown');

    strip.querySelector('img')!.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(strip.classList).toContain('shown');
    expect(strip.classList).toContain('cover');
  });

  it('falls back to the stored cover, then to the aura colours, when images fail', () => {
    cacheLibrary([playing(1)]);
    const fixture = create();
    const img = () => strips(fixture)[0].querySelector('img');

    img()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(img()!.getAttribute('src')).toBe(cover(1));

    img()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    const [strip] = strips(fixture);
    expect(img()).toBeNull();
    expect(strip.classList).toContain('shown');
    expect(strip.classList).not.toContain('cover');
  });

  it('shows a game without a cover as an aura-coloured strip', () => {
    cacheLibrary([playing(1, { coverImageUrl: null })]);
    const [strip] = strips(create());
    expect(strip.querySelector('img')).toBeNull();
    expect(strip.classList).toContain('shown');
  });

  it('reloads the library after a write and updates the strips without a page reload', () => {
    cacheLibrary([playing(1)]);
    const fixture = create();
    expect(strips(fixture)).toHaveLength(1);

    TestBed.inject(UserDataCache).invalidateAll();
    fixture.detectChanges();
    // The old strips stay until the reload answers.
    expect(strips(fixture)).toHaveLength(1);
    http.expectOne(gamesUrl).flush([playing(1), playing(2)]);
    fixture.detectChanges();
    expect(strips(fixture)).toHaveLength(2);
  });
});
