import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { Game } from '../../../core/models/game.model';
import { DemoModeService } from '../../../core/services/demo-mode.service';
import { GenreService } from '../../../core/services/genre.service';
import { SagaService } from '../../../core/services/saga.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { SyncSource } from '../sync.logic';
import { PendingConfirmDialog, PendingConfirmFn } from './pending-confirm-dialog';

const game = { id: 7, name: 'Astro Bot', category: 'SINGLEPLAYER', sagaId: null, genres: [] } as unknown as Game;
const failWith = (status: number, message: string): PendingConfirmFn => () =>
  throwError(() => new HttpErrorResponse({ status, error: { message } }));

describe('PendingConfirmDialog', () => {
  function setup(source: SyncSource, confirmWith: PendingConfirmFn) {
    const toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: ToastService, useValue: toast },
        { provide: DemoModeService, useValue: { isDemo: signal(false), blockWrite: () => false } },
        { provide: SagaService, useValue: { findAll: () => of([]) } },
        { provide: GenreService, useValue: { findAll: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(PendingConfirmDialog);
    fixture.componentRef.setInput('source', source);
    fixture.componentRef.setInput('game', game);
    fixture.componentRef.setInput('confirmWith', confirmWith);
    fixture.detectChanges();
    // ModalSheet moves its content to <body>.
    const el = document.body;
    const submit = () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    return { toast, el, submit };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('uses the PSN copy and PSN error messages for PSN games', () => {
    const { toast, el, submit } = setup('psn', failWith(409, 'PSN_LINK_CHANGED'));

    const form = el.querySelector('form')!;
    expect(form.textContent).toContain('psn.confirmDialog.intro');
    expect(form.textContent).not.toContain('steam.confirmDialog');

    submit();
    expect(toast.error).toHaveBeenCalledWith('psn.errors.linkChanged');
  });

  it('maps a PSN duplicate name to the PSN message', () => {
    const { toast, submit } = setup('psn', failWith(409, 'Game already exists'));

    submit();
    expect(toast.error).toHaveBeenCalledWith('psn.errors.duplicateName');
  });

  it('keeps the Steam messages for Steam games', () => {
    const { toast, submit } = setup('steam', failWith(409, 'SYNC_IN_PROGRESS'));

    submit();
    expect(toast.error).toHaveBeenCalledWith('steam.errors.syncInProgress');
  });
});
