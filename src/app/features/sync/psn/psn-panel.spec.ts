import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { Experience } from '../../../core/models/experience.model';
import { Game } from '../../../core/models/game.model';
import { PsnPendingGame, PsnStatus, PsnSyncResult } from '../../../core/models/psn.model';
import { DemoModeService } from '../../../core/services/demo-mode.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import { GenreService } from '../../../core/services/genre.service';
import { IgdbMetadataService } from '../../../core/services/igdb-metadata.service';
import { PsnService } from '../../../core/services/psn.service';
import { RunFormLauncher } from '../../../core/services/run-form-launcher.service';
import { SagaService } from '../../../core/services/saga.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { PsnPanel } from './psn-panel';
import { PSN_RUN_LABEL } from './psn.logic';

const status = (overrides: Partial<PsnStatus> = {}): PsnStatus => ({
  linked: false,
  accountId: null,
  onlineId: null,
  lastSyncAt: null,
  configured: true,
  linkedGamesCount: 0,
  pendingCount: 0,
  ignoredCount: 0,
  serviceAuthError: null,
  serviceAuthFailingSince: null,
  ...overrides,
});

const pendingGame = (overrides: Partial<PsnPendingGame> = {}): PsnPendingGame =>
  ({
    id: 7,
    name: 'Astro Bot',
    category: 'SINGLEPLAYER',
    coverImageUrl: null,
    genres: [],
    titleId: 'PPSA01325_00',
    psnPlatform: 'PS5',
    psnPlaytimeMinutes: 150,
    lastPlayedAt: null,
    ...overrides,
  }) as PsnPendingGame;

const apiError = (status: number, message: string) => new HttpErrorResponse({ status, error: { message } });

describe('PsnPanel', () => {
  let fixture: ComponentFixture<PsnPanel>;

  function setup({
    psnStatus = status(),
    pending = [] as PsnPendingGame[],
    demo = false,
    runs = [] as Experience[],
    firstStatusFails = false,
  } = {}) {
    const psn = {
      getStatus: vi.fn(() => of(psnStatus)),
      getPending: vi.fn(() => of(pending)),
      getIgnored: vi.fn(() => of([])),
      link: vi.fn((): Observable<PsnStatus> => of(status({ linked: true, onlineId: 'Kratos_99' }))),
      sync: vi.fn((): Observable<PsnSyncResult> => of({} as PsnSyncResult)),
      unlink: vi.fn(() => of(undefined)),
      ignorePending: vi.fn(() => of(undefined)),
      confirmPending: vi.fn(),
    };
    if (firstStatusFails) {
      psn.getStatus.mockReturnValueOnce(throwError(() => apiError(500, 'BOOM')));
    }
    const launcher = { openNewRun: vi.fn(), openEditRun: vi.fn() };
    const toast = { success: vi.fn(), error: vi.fn(), show: vi.fn() };
    const blockWrite = vi.fn(() => demo);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: PsnService, useValue: psn },
        { provide: DemoModeService, useValue: { isDemo: signal(demo), blockWrite } },
        { provide: ExperienceService, useValue: { findAllByGame: vi.fn(() => of(runs)) } },
        { provide: RunFormLauncher, useValue: launcher },
        { provide: ToastService, useValue: toast },
        { provide: SagaService, useValue: { findAll: () => of([]) } },
        { provide: GenreService, useValue: { findAll: () => of([]) } },
        { provide: GameService, useValue: { create: vi.fn(), update: vi.fn() } },
        { provide: IgdbMetadataService, useValue: { providers: () => of({ igdb: false }) } },
      ],
    });
    fixture = TestBed.createComponent(PsnPanel);
    fixture.detectChanges();
    return { psn, launcher, toast, blockWrite, component: fixture.componentInstance };
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const card = () => el().querySelector('[data-platform="playstation"]') as HTMLElement;
  const input = () => el().querySelector<HTMLInputElement>('#psn-online-id')!;
  const button = (key: string) =>
    [...el().querySelectorAll('button')].find((b) => b.textContent?.includes(key)) as HTMLButtonElement;

  function submitOnlineId(value: string): void {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    button('psn.link').click();
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  describe('while IGDB fills the pending games', () => {
    const filling = (processed: number) =>
      status({ linked: true, pendingCount: 2, enrichment: { active: true, processed, total: 2 } });

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('refreshes the list until the fill is done, without bringing back a row ignored meanwhile', () => {
      const { psn, component } = setup({
        psnStatus: filling(0),
        pending: [pendingGame({ id: 7 }), pendingGame({ id: 8, name: 'Gran Turismo 7' })],
      });
      expect(el().textContent).toContain('sync.enrichment.progress');

      component.ignore(component.pending()[0]);
      psn.getStatus.mockReturnValue(of(filling(1)));
      // Answer of a refresh sent before the ignore: game 7 is still in it.
      psn.getPending.mockReturnValue(of([pendingGame({ id: 7 }), pendingGame({ id: 8, name: 'Gran Turismo 7 (filled)' })]));
      vi.advanceTimersByTime(2500);
      expect(component.pending().map((g) => [g.id, g.name])).toEqual([[8, 'Gran Turismo 7 (filled)']]);

      psn.getStatus.mockReturnValue(of(status({ linked: true, enrichment: { active: false, processed: 0, total: 0 } })));
      vi.advanceTimersByTime(2500);
      fixture.detectChanges();
      const calls = psn.getPending.mock.calls.length;
      vi.advanceTimersByTime(10_000);

      expect(psn.getPending.mock.calls.length).toBe(calls);
      expect(el().textContent).not.toContain('sync.enrichment');
    });

    it('does not poll when the API reports no fill', () => {
      const { psn } = setup({ psnStatus: status({ linked: true }) });
      const calls = psn.getPending.mock.calls.length;

      vi.advanceTimersByTime(10_000);

      expect(psn.getPending.mock.calls.length).toBe(calls);
    });
  });

  it('not configured: shows "unavailable" and disables linking', () => {
    setup({ psnStatus: status({ configured: false }) });

    expect(card().textContent).toContain('psn.unavailablePill');
    expect(card().textContent).toContain('psn.notConfigured');
    expect(input().disabled).toBe(true);
    expect(button('psn.link').disabled).toBe(true);
  });

  it('not linked: validates the online ID before linking with the trimmed value', () => {
    const { psn } = setup();

    expect(card().textContent).toContain('psn.notLinkedPill');
    expect(card().textContent).toContain('psn.publicNote');

    submitOnlineId('a b');
    expect(psn.link).not.toHaveBeenCalled();
    expect(el().querySelector('#psn-online-id-error')?.textContent).toContain('psn.errors.invalidOnlineId');
    expect(input().getAttribute('aria-invalid')).toBe('true');

    submitOnlineId('  Kratos_99 ');
    expect(psn.link).toHaveBeenCalledWith('Kratos_99');
    expect(card().textContent).toContain('psn.linkedPill');
    expect(card().textContent).toContain('Kratos_99');
    expect(el().querySelector('[role="status"]')?.textContent).toContain('psn.linked');
  });

  it('shows the privacy steps when linking a private profile', () => {
    const { psn } = setup();
    psn.link.mockReturnValue(throwError(() => apiError(422, 'PSN_PROFILE_PRIVATE')));

    submitOnlineId('Kratos_99');

    expect(el().textContent).toContain('psn.private.title');
    expect(el().textContent).toContain('psn.private.step1');
    expect(el().textContent).toContain('psn.private.retryLink');
    expect(el().querySelector('.text-danger[role="alert"]')).toBeNull();
  });

  it('maps link API errors to a translated message', () => {
    const { psn } = setup();
    psn.link.mockReturnValue(throwError(() => apiError(404, 'PSN_USER_NOT_FOUND')));

    submitOnlineId('Kratos_99');

    expect(el().querySelector('[role="alert"]')?.textContent).toContain('psn.errors.userNotFound');
  });

  it('linked with pending: lists each game with console, hours and actions', () => {
    setup({
      psnStatus: status({ linked: true, onlineId: 'Kratos_99', pendingCount: 1 }),
      pending: [pendingGame({ psnPlatform: 'PS4' })],
    });

    expect(card().textContent).toContain('Kratos_99');
    expect(button('psn.sync')).toBeTruthy();
    expect(button('psn.unlink')).toBeTruthy();
    const row = el().querySelector('li') as HTMLElement;
    expect(row.textContent).toContain('Astro Bot');
    expect(row.textContent).toContain('PS4');
    expect(row.textContent).toMatch(/2[.,]5 h/);
    expect(row.textContent).toContain('steam.ignore');
    expect(row.textContent).toContain('steam.createRun');
  });

  it('ONLINE pending games cannot start a run and say why', () => {
    setup({
      psnStatus: status({ linked: true, pendingCount: 2 }),
      pending: [pendingGame({ category: 'ONLINE' }), pendingGame({ id: 8, name: 'Hybrid', category: 'HYBRID' })],
    });

    const [online, hybrid] = [...el().querySelectorAll('li')] as HTMLElement[];
    expect(online.querySelector<HTMLButtonElement>('[data-create-run]')!.disabled).toBe(true);
    expect(online.querySelector('[data-online-hint]')?.textContent).toContain('game.onlineNoRuns');
    expect(hybrid.querySelector<HTMLButtonElement>('[data-create-run]')!.disabled).toBe(false);
    expect(hybrid.querySelector('[data-online-hint]')).toBeNull();
  });

  it('a game confirmed as ONLINE in run mode shows its page with an explanation instead of a run', () => {
    const { component, launcher, toast } = setup({
      psnStatus: status({ linked: true, pendingCount: 1 }),
      pending: [pendingGame()],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.openConfirm(component.pending()[0], 'run');
    component.onConfirmed({ id: 7, name: 'Astro Bot', category: 'ONLINE' } as Game);

    expect(toast.show).toHaveBeenCalledWith('game.onlineNoRuns', 'info');
    expect(navigate).toHaveBeenCalledWith(['/games', 7]);
    expect(launcher.openNewRun).not.toHaveBeenCalled();
  });

  it('ignores a pending game and updates the counters', () => {
    const { psn } = setup({
      psnStatus: status({ linked: true, pendingCount: 1 }),
      pending: [pendingGame()],
    });

    button('steam.ignore').click();
    fixture.detectChanges();

    expect(psn.ignorePending).toHaveBeenCalledWith(7);
    expect(el().textContent).not.toContain('Astro Bot');
    expect(el().textContent).toContain('steam.noPending');
  });

  it('opens the PSN run after confirming a SINGLEPLAYER game, or a new run on its console', () => {
    const imported = { id: 3, runLabel: PSN_RUN_LABEL } as Experience;
    const { component, launcher } = setup({
      psnStatus: status({ linked: true, pendingCount: 2 }),
      pending: [pendingGame(), pendingGame({ id: 8, name: 'Hybrid', psnPlatform: 'PS4' })],
      runs: [imported, { id: 4, runLabel: 'Other' } as Experience],
    });

    component.openConfirm(component.pending()[0], 'run');
    component.onConfirmed({ id: 7, name: 'Astro Bot', category: 'SINGLEPLAYER' } as Game);
    expect(launcher.openEditRun).toHaveBeenCalledWith(imported);

    component.openConfirm(component.pending()[0], 'run');
    component.onConfirmed({ id: 8, name: 'Hybrid', category: 'HYBRID' } as Game);
    expect(launcher.openNewRun).toHaveBeenCalledWith(8, { platform: 'PS4' }, 'runForm.importedHoursHint.psn');
    expect(component.status()?.pendingCount).toBe(0);
  });

  it('confirming in the review dialog in run mode opens the run for the confirmed game', () => {
    const { component, psn, launcher } = setup({
      psnStatus: status({ linked: true, pendingCount: 1 }),
      pending: [pendingGame({ category: 'HYBRID', psnPlatform: 'PS4' })],
    });
    psn.confirmPending.mockReturnValue(of({ id: 7, name: 'Astro Bot', category: 'HYBRID' } as Game));

    component.openConfirm(component.pending()[0], 'run');
    fixture.detectChanges();
    // The dialog's modal sheet moves itself to <body>.
    document.body.querySelector('app-modal-sheet form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(psn.confirmPending).toHaveBeenCalledWith(7, expect.objectContaining({ name: 'Astro Bot', category: 'HYBRID' }));
    expect(launcher.openNewRun).toHaveBeenCalledWith(7, { platform: 'PS4' }, 'runForm.importedHoursHint.psn');
    expect(component.confirmTarget()).toBeNull();
    expect(document.body.querySelector('app-modal-sheet')).toBeNull();
  });

  it('shows the privacy steps instead of the summary after syncing a private profile', () => {
    const { psn } = setup({ psnStatus: status({ linked: true }) });
    psn.sync.mockReturnValue(of({ profilePrivate: true } as PsnSyncResult));

    button('psn.sync').click();
    fixture.detectChanges();

    expect(el().textContent).toContain('psn.private.title');
    expect(el().textContent).toContain('psn.private.retrySync');
    expect(el().textContent).not.toContain('psn.result.title');
  });

  it('clears the status error banner after a later successful status load', () => {
    const { component } = setup({ psnStatus: status({ linked: true }), firstStatusFails: true });
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('psn.errors.generic');

    (component as unknown as { loadStatus(): void }).loadStatus();
    fixture.detectChanges();
    expect(el().querySelector('[role="alert"]')).toBeNull();
    expect(card().textContent).toContain('psn.linkedPill');
  });

  it('warns admins when the PSN service account is rejected', () => {
    setup({ psnStatus: status({ serviceAuthError: 'PSN_SERVICE_AUTH_FAILED' }) });

    expect(card().textContent).toContain('psn.serviceAuthFailed');
  });

  it('demo: writes stop at the demo guard', () => {
    const { psn, blockWrite } = setup({ demo: true });

    submitOnlineId('Kratos_99');

    expect(blockWrite).toHaveBeenCalled();
    expect(psn.link).not.toHaveBeenCalled();
  });
});
