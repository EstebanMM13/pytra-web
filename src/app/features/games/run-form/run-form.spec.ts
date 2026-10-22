import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { Experience, ExperienceStatus } from '../../../core/models/experience.model';
import { Game, GameCategory } from '../../../core/models/game.model';
import { Platform } from '../../../core/models/platform.model';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import { PlatformService } from '../../../core/services/platform.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { RunFormLauncher, RunFormRequest } from '../../../core/services/run-form-launcher.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { todayIso } from '../../../shared/utils/run-dates';
import { RunForm } from './run-form';

const PC: Platform = { id: 1, name: 'PC', color: '#8A857C', family: 'PC', legacyCode: 'PC', sortOrder: 10 };

function game(id: number, name: string, category: GameCategory): Game {
  return {
    id,
    name,
    developer: null,
    publisher: null,
    releaseDate: null,
    category,
    sagaId: null,
    sagaName: null,
    coverImageUrl: null,
    reviewStatus: 'CONFIRMED',
    genres: [],
    updatedAt: '2026-01-01T00:00:00',
  };
}

const GAMES = [game(1, 'Zelda', 'SINGLEPLAYER'), game(2, 'Fortnite', 'ONLINE'), game(3, 'COD', 'HYBRID')];

/** What the specs reach into: the form and the protected handlers the template calls. */
interface RunFormHarness {
  form: RunForm['form'];
  setStatus(status: ExperienceStatus): void;
  onEndDateChange(input: Pick<HTMLInputElement, 'value' | 'validity'>): void;
  games(): Game[] | null;
  selectGame(game: Game): void;
  toggle(control: 'platinum' | 'replay'): void;
}

function experience(overrides: Partial<Experience> = {}): Experience {
  return {
    id: 9,
    gameId: 2,
    runLabel: 'Season 1',
    year: null,
    status: 'EN_CURSO',
    rating: null,
    hours: 3,
    startDate: null,
    endDate: null,
    platform: 'PC',
    platformId: 1,
    platformName: 'PC',
    platformColor: '#8A857C',
    platinum: false,
    replay: false,
    summary: null,
    pros: null,
    cons: null,
    notes: null,
    updatedAt: '2026-01-01T00:00:00',
    ...overrides,
  };
}

function dateInput(value: string, badInput = false): Pick<HTMLInputElement, 'value' | 'validity'> {
  return { value, validity: { badInput } as ValidityState };
}

describe('RunForm', () => {
  const launcher = { close: vi.fn(), notifySaved: vi.fn(), request: signal(null) };
  const toast = { success: vi.fn(), error: vi.fn(), show: vi.fn() };

  /** `runCounts`: how many runs each game id already has (none by default). */
  function setup(request: RunFormRequest, runCounts: Record<number, number> = {}) {
    launcher.close.mockClear();
    toast.show.mockClear();
    TestBed.configureTestingModule({
      imports: [RunForm],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: GameService, useValue: { findAll: () => of(GAMES), findById: (id: number) => of(GAMES.find((g) => g.id === id)) } },
        {
          provide: ExperienceService,
          useValue: { findAllByGame: (id: number) => of(Array.from({ length: runCounts[id] ?? 0 }, (_, i) => ({ id: i }))) },
        },
        { provide: PlatformService, useValue: { platforms: signal([PC]), load: () => of([PC]) } },
        { provide: PreferencesService, useValue: { defaultPlatform: () => 'PC', ratingPrecision: () => 'hundredths' } },
        { provide: RunFormLauncher, useValue: launcher },
        { provide: ToastService, useValue: toast },
      ],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RunForm);
    fixture.componentRef.setInput('request', request);
    fixture.detectChanges();
    return { form: fixture.componentInstance as unknown as RunFormHarness, navigate, fixture };
  }

  describe('status and end date', () => {
    const create: RunFormRequest = { mode: 'create', gameId: 1, navigateOnCreate: false };

    it('completing fills today as end date, and clearing it reopens the run', () => {
      const { form } = setup(create);
      form.setStatus('COMPLETADO');
      expect(form.form.controls.endDate.value).toBe(todayIso());

      form.form.controls.endDate.setValue('');
      form.onEndDateChange(dateInput(''));
      expect(form.form.controls.status.value).toBe('EN_CURSO');
    });

    it('a past end date completes a run in progress, a future one does not', () => {
      const { form } = setup(create);
      form.setStatus('EN_CURSO');

      form.onEndDateChange(dateInput('2999-01-01'));
      expect(form.form.controls.status.value).toBe('EN_CURSO');

      form.onEndDateChange(dateInput('2020-05-01'));
      expect(form.form.controls.status.value).toBe('COMPLETADO');
    });

    it('a date being typed (empty value with badInput) does not reopen a completed run', () => {
      const { form } = setup(create);
      form.setStatus('COMPLETADO');

      form.onEndDateChange(dateInput('', true));
      expect(form.form.controls.status.value).toBe('COMPLETADO');
    });

    it('never changes an abandoned run', () => {
      const { form } = setup(create);
      form.setStatus('ABANDONADO');

      form.onEndDateChange(dateInput('2020-05-01'));
      form.onEndDateChange(dateInput(''));
      expect(form.form.controls.status.value).toBe('ABANDONADO');
    });
  });

  describe('Replay default', () => {
    const create: RunFormRequest = { mode: 'create', gameId: 1, navigateOnCreate: false };

    it('is off for the first run of a game', () => {
      const { form } = setup(create);
      expect(form.form.controls.replay.value).toBe(false);
      expect(form.form.controls.runLabel.value).toBe('Run 1');
    });

    it('is on for a new run of a game that already has runs', () => {
      const { form } = setup(create, { 1: 2 });
      expect(form.form.controls.replay.value).toBe(true);
    });

    it('follows the game picked in the global form', () => {
      const { form } = setup({ mode: 'create', navigateOnCreate: true }, { 1: 1 });
      expect(form.form.controls.replay.value).toBe(false);
      form.selectGame(GAMES[0]);
      expect(form.form.controls.replay.value).toBe(true);
      form.selectGame(GAMES[2]);
      expect(form.form.controls.replay.value).toBe(false);
    });

    it('keeps the user choice once toggled', () => {
      const { form } = setup({ mode: 'create', navigateOnCreate: true }, { 1: 1, 3: 1 });
      form.selectGame(GAMES[0]);
      form.toggle('replay');
      expect(form.form.controls.replay.value).toBe(false);
      form.selectGame(GAMES[2]);
      expect(form.form.controls.replay.value).toBe(false);
    });

    it('keeps the stored value when editing a run', () => {
      const { form } = setup({ mode: 'edit', experience: experience({ gameId: 1, replay: false }) }, { 1: 3 });
      expect(form.form.controls.replay.value).toBe(false);
    });
  });

  describe('best / worst section', () => {
    /** ModalSheet moves itself to <body>, so its content is queried from the document. */
    function parts() {
      return {
        reveal: document.querySelector<HTMLButtonElement>('button[aria-controls="run-form-more"]')!,
        pros: () => document.querySelector('#run-form-pros'),
      };
    }

    it('is collapsed behind a visible toggle row for a new run, and opens on click', () => {
      const { fixture } = setup({ mode: 'create', gameId: 1, navigateOnCreate: false });
      const { reveal, pros } = parts();
      expect(reveal.textContent).toContain('runForm.bestWorst');
      expect(reveal.getAttribute('aria-expanded')).toBe('false');
      expect(pros()).toBeNull();

      reveal.click();
      fixture.detectChanges();
      expect(reveal.getAttribute('aria-expanded')).toBe('true');
      expect(pros()).not.toBeNull();
    });

    it('starts expanded when the edited run already has best / worst content', () => {
      setup({ mode: 'edit', experience: experience({ gameId: 1, cons: 'Backtracking' }) });
      const { reveal, pros } = parts();
      expect(reveal.getAttribute('aria-expanded')).toBe('true');
      expect(pros()).not.toBeNull();
    });
  });

  describe('ONLINE games', () => {
    it('are left out of the game picker of a new run', () => {
      const { form } = setup({ mode: 'create', navigateOnCreate: true });
      expect(form.games()?.map((g) => g.name)).toEqual(['COD', 'Zelda']);
    });

    it('opening a new run for one explains why and shows the game page instead', () => {
      const { navigate } = setup({ mode: 'create', gameId: 2, navigateOnCreate: false });
      expect(toast.show).toHaveBeenCalledWith('game.onlineNoRuns', 'info');
      expect(launcher.close).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/games', 2]);
    });

    it('existing runs can still be edited', () => {
      const { navigate } = setup({ mode: 'edit', experience: experience({ gameId: 2, runLabel: 'Season 1' }) });
      expect(launcher.close).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(toast.show).not.toHaveBeenCalled();
    });
  });

  describe('hint under the hours', () => {
    it('shows the note the opener asked for on a new run', () => {
      setup({ mode: 'create', gameId: 3, navigateOnCreate: false, hintKey: 'runForm.importedHoursHint.steam' });
      expect(document.body.textContent).toContain('runForm.importedHoursHint.steam');
    });

    it('shows nothing when no note was asked for', () => {
      setup({ mode: 'create', gameId: 3, navigateOnCreate: false });
      expect(document.body.textContent).not.toContain('runForm.importedHoursHint');
    });
  });
});
