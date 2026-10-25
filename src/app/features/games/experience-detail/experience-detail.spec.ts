import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { EMPTY, Subject, of } from 'rxjs';
import { Experience } from '../../../core/models/experience.model';
import { DemoModeService } from '../../../core/services/demo-mode.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { RatingScale, ratingScaleMax } from '../../../shared/utils/rating-scale';
import { RunFormLauncher } from '../../../core/services/run-form-launcher.service';
import { StatsService } from '../../../core/services/stats.service';
import { Navbar } from '../../../shared/navbar/navbar';
import { ToastService } from '../../../shared/toast/toast.service';
import { ExperienceDetail } from './experience-detail';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

function run(overrides: Partial<Experience> = {}): Experience {
  return {
    id: 11,
    gameId: 7,
    runLabel: 'Run 1',
    year: 2024,
    status: 'EN_CURSO',
    rating: 8.5,
    hours: 12.5,
    startDate: '2024-01-01',
    endDate: null,
    platform: 'PC',
    platformId: 1,
    platformName: 'PC',
    platformColor: null,
    platinum: false,
    fullCompletion: false,
    replay: false,
    summary: null,
    pros: null,
    cons: null,
    notes: null,
    updatedAt: '2026-01-01T00:00:00',
    ...overrides,
  };
}

describe('ExperienceDetail inline edit', () => {
  let patch: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;
  let blockWrite: ReturnType<typeof vi.fn>;

  function setup(experience = run(), demo = false, scale: RatingScale = '10') {
    patch = vi.fn();
    toastError = vi.fn();
    blockWrite = vi.fn(() => demo);
    TestBed.configureTestingModule({
      imports: [ExperienceDetail],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ gameId: '7', id: String(experience.id) })) },
        },
        { provide: ExperienceService, useValue: { findById: () => of(experience), patch, delete: vi.fn() } },
        { provide: GameService, useValue: { cachedById: () => null, findById: () => EMPTY } },
        { provide: StatsService, useValue: { getTopRated: () => of([]) } },
        { provide: RunFormLauncher, useValue: { saved$: EMPTY, openEditRun: vi.fn() } },
        {
          provide: PreferencesService,
          useValue: {
            ratingPrecision: signal('hundredths'),
            ratingScale: signal(scale),
            ratingMax: signal(ratingScaleMax(scale)),
          },
        },
        { provide: DemoModeService, useValue: { isDemo: signal(demo), blockWrite } },
        { provide: ToastService, useValue: { success: vi.fn(), error: toastError } },
      ],
    });
    TestBed.overrideComponent(ExperienceDetail, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(ExperienceDetail);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const byId = <T extends HTMLElement>(id: string) => el.querySelector<T>(`#${id}`);
    const type = (input: HTMLInputElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const key = (target: HTMLElement, name: string) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
    return { fixture, el, byId, type, key };
  }

  function openHours(t: ReturnType<typeof setup>): HTMLInputElement {
    t.byId<HTMLButtonElement>('run-inline-hours-trigger')!.click();
    t.fixture.detectChanges();
    return t.byId<HTMLInputElement>('run-inline-hours')!;
  }

  it('turns the hours into a labelled input that saves on Enter', () => {
    const t = setup();
    const saved = new Subject<Experience>();
    patch.mockReturnValue(saved);
    const trigger = t.byId<HTMLButtonElement>('run-inline-hours-trigger')!;
    expect(trigger.getAttribute('aria-label')).toBe('run.inlineEditHours');

    const input = openHours(t);
    expect(input.value).toBe('12,5');
    expect(input.getAttribute('aria-label')).toBe('run.inlineHoursLabel');
    expect(input.getAttribute('inputmode')).toBe('decimal');

    t.type(input, '14,25');
    t.key(input, 'Enter');
    t.fixture.detectChanges();

    expect(patch).toHaveBeenCalledWith(11, { hours: 14.25 });
    expect(t.byId('run-inline-hours')).toBeNull();
    // Optimistic: shown at once, read-only until the API answers.
    const pending = t.byId<HTMLButtonElement>('run-inline-hours-trigger')!;
    expect(pending.textContent).toContain('14');
    expect(pending.disabled).toBe(true);

    saved.next(run({ hours: 14.25 }));
    t.fixture.detectChanges();
    expect(t.byId<HTMLButtonElement>('run-inline-hours-trigger')!.disabled).toBe(false);
  });

  it('adds the quick steps to the typed hours before saving', () => {
    const t = setup();
    patch.mockReturnValue(of(run({ hours: 14 })));
    const input = openHours(t);
    const steps = [...t.el.querySelectorAll<HTMLButtonElement>('.run-inline-step')];
    expect(steps.map((b) => b.textContent?.trim())).toEqual(['+0,5', '+1']);

    steps[0].click();
    steps[1].click();
    t.fixture.detectChanges();
    expect(input.value).toBe('14');

    t.key(input, 'Enter');
    expect(patch).toHaveBeenCalledWith(11, { hours: 14 });
  });

  it('cancels with Escape without saving', () => {
    const t = setup();
    const input = openHours(t);
    t.type(input, '99');
    t.key(input, 'Escape');
    t.fixture.detectChanges();

    expect(t.byId('run-inline-hours')).toBeNull();
    expect(t.byId('run-inline-hours-trigger')!.textContent).toContain('12');
    expect(patch).not.toHaveBeenCalled();
  });

  it('keeps invalid hours open with an error on Enter and drops them when focus leaves', () => {
    const t = setup();
    const input = openHours(t);
    t.type(input, '-3');
    t.key(input, 'Enter');
    t.fixture.detectChanges();

    expect(t.byId('run-inline-hours')).not.toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(t.byId('run-inline-hours-error')).not.toBeNull();

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    t.fixture.detectChanges();
    expect(t.byId('run-inline-hours')).toBeNull();
    expect(patch).not.toHaveBeenCalled();
  });

  it('saves when focus leaves the editor, but not when it moves to a quick step', () => {
    const t = setup();
    patch.mockReturnValue(of(run({ hours: 20 })));
    const input = openHours(t);
    t.type(input, '20');
    const step = t.el.querySelector<HTMLButtonElement>('.run-inline-step')!;
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: step }));
    expect(patch).not.toHaveBeenCalled();

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(patch).toHaveBeenCalledWith(11, { hours: 20 });
  });

  it('does not call the API when the value is unchanged', () => {
    const t = setup();
    const input = openHours(t);
    t.key(input, 'Enter');
    expect(patch).not.toHaveBeenCalled();
  });

  it('rolls back and shows a toast when the save fails', () => {
    const t = setup();
    const saved = new Subject<Experience>();
    patch.mockReturnValue(saved);
    const input = openHours(t);
    t.type(input, '30');
    t.key(input, 'Enter');
    t.fixture.detectChanges();
    expect(t.byId('run-inline-hours-trigger')!.textContent).toContain('30');

    saved.error(new HttpErrorResponse({ status: 500 }));
    t.fixture.detectChanges();
    expect(t.byId('run-inline-hours-trigger')!.textContent).toContain('12');
    expect(t.byId<HTMLButtonElement>('run-inline-hours-trigger')!.disabled).toBe(false);
    expect(toastError).toHaveBeenCalled();
  });

  it('edits the rating with the precision rules and can clear it', () => {
    const t = setup();
    patch.mockReturnValue(of(run({ rating: 9.25 })));
    t.byId<HTMLButtonElement>('run-inline-rating-trigger')!.click();
    t.fixture.detectChanges();
    const input = t.byId<HTMLInputElement>('run-inline-rating')!;
    expect(input.value).toBe('8,5');

    t.type(input, '10,5');
    t.key(input, 'Enter');
    t.fixture.detectChanges();
    expect(patch).not.toHaveBeenCalled();
    expect(t.byId('run-inline-rating-error')).not.toBeNull();

    t.type(input, '9,25');
    t.key(input, 'Enter');
    expect(patch).toHaveBeenCalledWith(11, { rating: 9.25 });

    patch.mockReturnValue(of(run({ rating: null })));
    t.fixture.detectChanges();
    t.byId<HTMLButtonElement>('run-inline-rating-trigger')!.click();
    t.fixture.detectChanges();
    const again = t.byId<HTMLInputElement>('run-inline-rating')!;
    t.type(again, '');
    t.key(again, 'Enter');
    expect(patch).toHaveBeenLastCalledWith(11, { rating: null });
  });

  it('shows and edits the rating on the scale preference, saving it on 0–10', () => {
    const t = setup(run({ rating: 8.75 }), false, '100');
    const trigger = t.byId<HTMLButtonElement>('run-inline-rating-trigger')!;
    expect(trigger.textContent).toContain('87,5');
    expect(t.el.querySelector('[data-stat="rating"]')!.textContent).toContain('run.outOf');
    // The meter stays a percent of the max: 8.75 / 10.
    expect(t.el.querySelector<HTMLElement>('[data-stat="rating"] .bar-fill')!.style.width).toBe('87.5%');

    patch.mockReturnValue(of(run({ rating: 9.3 })));
    trigger.click();
    t.fixture.detectChanges();
    const input = t.byId<HTMLInputElement>('run-inline-rating')!;
    expect(input.value).toBe('87,5');

    t.type(input, '101');
    t.key(input, 'Enter');
    expect(patch).not.toHaveBeenCalled();

    t.type(input, '93');
    t.key(input, 'Enter');
    expect(patch).toHaveBeenCalledWith(11, { rating: 9.3 });
  });

  it('offers adding a rating to an unrated run', () => {
    const t = setup(run({ rating: null }));
    const trigger = t.byId<HTMLButtonElement>('run-inline-rating-trigger')!;
    expect(trigger.getAttribute('aria-label')).toBe('run.inlineAddRating');
    trigger.click();
    t.fixture.detectChanges();
    expect(t.byId<HTMLInputElement>('run-inline-rating')!.value).toBe('');
  });

  it('shows the 100% pill only on a run flagged 100%, independent of the platinum', () => {
    expect(setup(run({ platinum: true })).el.querySelector('[data-full-completion]')).toBeNull();
    TestBed.resetTestingModule();

    const pill = setup(run({ fullCompletion: true })).el.querySelector('[data-full-completion]')!;
    expect(pill.classList).toContain('completion-pill');
    expect(pill.textContent).toContain('run.fullCompletion');
    expect(pill.querySelector('.sr-only')!.textContent).toContain('run.fullCompletionAria');
  });

  it('never sends the change in the read-only demo', () => {
    const t = setup(run(), true);
    const input = openHours(t);
    t.type(input, '40');
    t.key(input, 'Enter');
    t.fixture.detectChanges();

    expect(blockWrite).toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
    expect(t.byId('run-inline-hours-trigger')!.textContent).toContain('12');
  });
});
