import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { EMPTY, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Game, GameCategory } from '../../../core/models/game.model';
import { DemoModeService } from '../../../core/services/demo-mode.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import { OnlinePlaytimeService } from '../../../core/services/online-playtime.service';
import { PlatformService } from '../../../core/services/platform.service';
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
        { provide: GameService, useValue: { findById: () => of(g), findAll: () => of([g]) } },
        { provide: ExperienceService, useValue: { findAllByGame: () => of([]) } },
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

  it('offers edit, new run and the first-run link to a signed-in user', () => {
    const { buttons } = setup(game('SINGLEPLAYER'));
    expect(buttons('game.editAria').length).toBe(1);
    expect(buttons('game.edit').length).toBe(1);
    expect(buttons('game.newRun').length).toBeGreaterThan(0);
    expect(buttons('game.firstRun').length).toBe(1);
    buttons('game.firstRun')[0].click();
    expect(launcher.openNewRun).toHaveBeenCalledWith(7);
  });

  it('hides every edit and run entry point in the read-only demo', () => {
    const { buttons, el } = setup(game('SINGLEPLAYER'), true);
    expect(buttons('game.editAria')).toEqual([]);
    expect(buttons('game.edit')).toEqual([]);
    expect(buttons('game.newRun')).toEqual([]);
    expect(buttons('game.firstRun')).toEqual([]);
    expect(el.textContent).toContain('game.noRuns');
  });

  it('never starts a run in demo mode, even when called directly', () => {
    const { fixture } = setup(game('SINGLEPLAYER'), true);
    (fixture.componentInstance as unknown as { newRun(): void }).newRun();
    expect(blockWrite).toHaveBeenCalled();
    expect(launcher.openNewRun).not.toHaveBeenCalled();
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
  function render(category: GameCategory, generalRating: number | null = null) {
    TestBed.configureTestingModule({
      imports: [GameDetail],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } },
        { provide: GameService, useValue: { findById: () => of(game(category)), findAll: () => of([]) } },
        { provide: ExperienceService, useValue: { findAllByGame: () => of([]) } },
        {
          provide: OnlinePlaytimeService,
          useValue: { findByGame: () => of({ gameId: 7, totalHours: 20, generalRating, platforms: [] }) },
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
    expect(hours.textContent).toContain('game.stats.campaign');
    expect(hours.textContent).toContain('game.stats.online');
  });

  it('shows the four equal cards and no split for single-player games', () => {
    const el = render('SINGLEPLAYER');
    expect(el.querySelector('[data-stat="hours"]')!.textContent).not.toContain('game.stats.online');
    expect(el.querySelectorAll('app-stat-card').length).toBe(4);
  });

  it('shows only total hours and the online rating for ONLINE games', () => {
    const el = render('ONLINE', 8);
    const cards = [...el.querySelectorAll('app-stat-card')];
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('game.stats.rating');
    expect(cards[0].textContent).toContain('8');
    const hours = el.querySelector('[data-stat="hours"]')!;
    expect(hours.textContent).toContain('20 h');
    // No runs: no campaign / online split.
    expect(hours.textContent).not.toContain('game.stats.campaign');
    expect(el.textContent).not.toContain('game.stats.platinum');
    expect(el.textContent).not.toContain('game.stats.bestRating');
  });

  it('reserves the saga line so the title does not move without a saga', () => {
    const line = render('SINGLEPLAYER').querySelector('[data-saga-line]')!;
    expect(line.tagName).toBe('SPAN');
    expect(line.getAttribute('aria-hidden')).toBe('true');
    expect(line.nextElementSibling?.tagName).toBe('H1');
  });
});
