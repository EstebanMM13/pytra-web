import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { Game } from '../../../core/models/game.model';
import { Genre } from '../../../core/models/genre.model';
import { Saga } from '../../../core/models/saga.model';
import { GameService } from '../../../core/services/game.service';
import { GenreService } from '../../../core/services/genre.service';
import { IgdbMetadataService } from '../../../core/services/igdb-metadata.service';
import { SagaService } from '../../../core/services/saga.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { PendingConfirmFn, PendingReview } from '../../sync/shared/pending-review';
import { GameEditDialog, coverNeedsWarning } from './game-edit-dialog';
import { AutofillPick } from './metadata-autofill.logic';

const SAGAS: Saga[] = [
  { id: 1, name: 'God of War', updatedAt: '' },
  { id: 2, name: 'Hollow Knight', updatedAt: '' },
];
const GENRES: Genre[] = [
  { id: 10, name: 'ACCIÓN' },
  { id: 11, name: 'AVENTURA' },
];

/** The parts of the dialog the specs read. */
interface DialogHarness {
  form: GameEditDialog['form'];
  selectedGenreIds(): Set<number>;
}

describe('GameEditDialog pickers', () => {
  let sagaCreate: ReturnType<typeof vi.fn>;
  let genreCreate: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;

  function setup() {
    toastError = vi.fn();
    TestBed.configureTestingModule({
      imports: [GameEditDialog],
      providers: [
        provideTranslateService(),
        { provide: GameService, useValue: { create: vi.fn(), update: vi.fn(), delete: vi.fn() } },
        { provide: SagaService, useValue: { findAll: () => of(SAGAS), create: sagaCreate } },
        { provide: GenreService, useValue: { findAll: () => of(GENRES), createIfMissing: genreCreate } },
        { provide: IgdbMetadataService, useValue: { providers: () => of({ igdb: false }) } },
        { provide: ToastService, useValue: { success: vi.fn(), error: toastError } },
      ],
    });
    const fixture = TestBed.createComponent(GameEditDialog);
    fixture.detectChanges();
    // The modal sheet moves itself to <body> once rendered.
    const el = document.body.querySelector('app-modal-sheet') as HTMLElement;
    const dialog = fixture.componentInstance as unknown as DialogHarness;
    const sagaInput = el.querySelector('#game-edit-saga') as HTMLInputElement;
    const genreInput = el.querySelector('app-combobox[multiple] input') as HTMLInputElement;
    const type = (input: HTMLInputElement, text: string) => {
      input.dispatchEvent(new Event('focus'));
      input.value = text;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const enter = (input: HTMLInputElement) => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
      fixture.detectChanges();
    };
    return { fixture, el, dialog, sagaInput, genreInput, type, enter };
  }

  beforeEach(() => {
    sagaCreate = vi.fn();
    genreCreate = vi.fn();
  });

  it('puts the picked saga into the form and picked genres into the selection', () => {
    const { dialog, sagaInput, genreInput, type, enter } = setup();
    type(sagaInput, 'hollow');
    enter(sagaInput);
    expect(dialog.form.controls.sagaId.value).toBe(2);
    expect(dialog.form.controls.sagaId.dirty).toBe(true);

    type(genreInput, 'aven');
    enter(genreInput);
    expect([...dialog.selectedGenreIds()]).toEqual([11]);
  });

  it('creates a missing saga once and selects it', () => {
    const response = new Subject<Saga>();
    sagaCreate.mockReturnValue(response);
    const { fixture, dialog, sagaInput, type, enter } = setup();
    type(sagaInput, 'Zelda');
    enter(sagaInput);
    enter(sagaInput); // Second Enter while the first request is pending: ignored.
    expect(sagaCreate).toHaveBeenCalledTimes(1);
    expect(sagaCreate).toHaveBeenCalledWith({ name: 'Zelda' });

    response.next({ id: 3, name: 'Zelda', updatedAt: '' });
    response.complete();
    fixture.detectChanges();
    expect(dialog.form.controls.sagaId.value).toBe(3);
  });

  it('creates a missing genre and selects it', () => {
    genreCreate.mockReturnValue(of({ id: 12, name: 'METROIDVANIA' }));
    const { dialog, genreInput, type, enter } = setup();
    type(genreInput, 'Metroidvania');
    enter(genreInput);
    expect(genreCreate).toHaveBeenCalledWith({ name: 'Metroidvania' });
    expect([...dialog.selectedGenreIds()]).toEqual([12]);
    expect(genreInput.value).toBe('');
  });

  it('keeps the typed name and explains the failure when a create fails', () => {
    genreCreate.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const { dialog, genreInput, type, enter } = setup();
    type(genreInput, 'Metroidvania');
    enter(genreInput);
    expect(toastError).toHaveBeenCalledWith('errors.network');
    expect(dialog.selectedGenreIds().size).toBe(0);
    expect(genreInput.value).toBe('Metroidvania');

    // Retrying is possible once the failed request settled.
    genreCreate.mockReturnValue(of({ id: 12, name: 'METROIDVANIA' }));
    enter(genreInput);
    expect(genreCreate).toHaveBeenCalledTimes(2);
  });

  it('warns about a cover that loads as non-portrait and offers the autofill search', () => {
    const { fixture, el, dialog } = setup();
    dialog.form.controls.coverImageUrl.setValue('https://images.example.com/wide.jpg');
    fixture.detectChanges();
    expect(el.querySelector('[data-cover-warning]')).toBeNull();

    const img = el.querySelector('app-game-cover img') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 460 });
    Object.defineProperty(img, 'naturalHeight', { value: 215 });
    img.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    const warning = el.querySelector('[data-cover-warning]')!;
    expect(warning.textContent).toContain('game.form.coverNotPortrait');

    warning.querySelector('button')!.click();
    fixture.detectChanges();
    expect(el.querySelector('app-metadata-autofill')).not.toBeNull();

    // A new url clears the warning until its own image loads.
    dialog.form.controls.coverImageUrl.setValue('https://images.example.com/other.jpg');
    fixture.detectChanges();
    expect(el.querySelector('[data-cover-warning]')).toBeNull();
  });
});

describe('GameEditDialog pending review', () => {
  const PENDING = {
    id: 7,
    name: 'Astro Bot',
    developer: 'Team Asobi',
    publisher: 'Sony',
    releaseDate: '2024-09-06',
    category: null,
    sagaId: 2,
    sagaName: 'Hollow Knight',
    coverImageUrl: 'https://images.example.com/astro.jpg',
    reviewStatus: 'PENDING_REVIEW',
    genres: [{ id: 11, name: 'AVENTURA' }],
    titleId: 'PPSA01234_00',
  } as unknown as Game;

  const failWith = (status: number, message: string): PendingConfirmFn => () =>
    throwError(() => new HttpErrorResponse({ status, error: { message } }));

  function setup(review: PendingReview) {
    const toast = { success: vi.fn(), error: vi.fn() };
    const gameService = { create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      imports: [GameEditDialog],
      providers: [
        provideTranslateService(),
        { provide: GameService, useValue: gameService },
        { provide: SagaService, useValue: { findAll: () => of(SAGAS) } },
        { provide: GenreService, useValue: { findAll: () => of(GENRES) } },
        { provide: IgdbMetadataService, useValue: { providers: () => of({ igdb: false }) } },
        { provide: ToastService, useValue: toast },
      ],
    });
    const fixture = TestBed.createComponent(GameEditDialog);
    fixture.componentRef.setInput('game', PENDING);
    fixture.componentRef.setInput('pendingReview', review);
    fixture.detectChanges();
    const el = document.body.querySelector('app-modal-sheet') as HTMLElement;
    const dialog = fixture.componentInstance as unknown as DialogHarness;
    const submit = () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    return { fixture, el, dialog, toast, gameService, submit };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('prefills every field from the pending game and defaults a missing category', () => {
    const { dialog, el } = setup({ source: 'steam', mode: 'confirm', confirmWith: vi.fn() });
    expect(dialog.form.getRawValue()).toEqual({
      name: 'Astro Bot',
      developer: 'Team Asobi',
      publisher: 'Sony',
      releaseDate: '2024-09-06',
      sagaId: 2,
      coverImageUrl: 'https://images.example.com/astro.jpg',
    });
    expect([...dialog.selectedGenreIds()]).toEqual([11]);
    expect(el.querySelector('[role="radio"][aria-checked="true"]')!.textContent).toContain('category.SINGLEPLAYER');
  });

  it('uses the source copy, the run variants and offers no delete', () => {
    const { el } = setup({ source: 'psn', mode: 'run', confirmWith: vi.fn() });
    expect(el.textContent).toContain('psn.confirmDialog.title');
    expect(el.textContent).toContain('psn.confirmDialog.saveAndRun');
    expect(el.querySelector('[data-review-intro]')!.textContent).toContain('psn.confirmDialog.introRun');
    expect(el.textContent).not.toContain('steam.confirmDialog');
    expect(el.textContent).not.toContain('game.delete');
  });

  it('confirms with the edited form and emits the confirmed game without a toast', () => {
    const confirmed = { ...PENDING, reviewStatus: 'CONFIRMED' } as Game;
    const confirmWith = vi.fn<PendingConfirmFn>(() => of(confirmed));
    const { fixture, dialog, toast, gameService, submit } = setup({ source: 'steam', mode: 'confirm', confirmWith });
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    dialog.form.controls.developer.setValue('  ');

    submit();
    expect(confirmWith).toHaveBeenCalledWith(7, {
      name: 'Astro Bot',
      developer: null,
      publisher: 'Sony',
      releaseDate: '2024-09-06',
      category: 'SINGLEPLAYER',
      sagaId: 2,
      coverImageUrl: 'https://images.example.com/astro.jpg',
      genreIds: [11],
    });
    expect(saved).toHaveBeenCalledWith(confirmed);
    expect(gameService.create).not.toHaveBeenCalled();
    expect(gameService.update).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('keeps the autofill search and its "filled from" note', () => {
    const { fixture, el, dialog } = setup({ source: 'steam', mode: 'confirm', confirmWith: vi.fn() });
    const button = el.querySelector('form > div > button') as HTMLButtonElement;
    expect(button.textContent).toContain('game.autofill.open');
    button.click();
    fixture.detectChanges();
    expect(el.querySelector('app-metadata-autofill')).not.toBeNull();

    (dialog as unknown as { applyAutofill(pick: AutofillPick): void }).applyAutofill({
      source: 'igdb',
      metadata: { name: 'Astro Bot', developer: 'Team Asobi', publisher: null, releaseDate: null, coverImageUrl: null, genres: [] },
    });
    fixture.detectChanges();
    expect(el.querySelector('app-metadata-autofill')).toBeNull();
    expect(el.querySelector('p[role="status"]')!.textContent).toContain('game.autofill.filled');
  });

  it('uses the PSN error messages for PSN games', () => {
    const { toast, submit } = setup({ source: 'psn', mode: 'confirm', confirmWith: failWith(409, 'PSN_LINK_CHANGED') });
    submit();
    expect(toast.error).toHaveBeenCalledWith('psn.errors.linkChanged');
  });

  it('maps a PSN duplicate name to the PSN message', () => {
    const { toast, submit } = setup({ source: 'psn', mode: 'confirm', confirmWith: failWith(409, 'Game already exists') });
    submit();
    expect(toast.error).toHaveBeenCalledWith('psn.errors.duplicateName');
  });

  it('keeps the Steam messages for Steam games', () => {
    const { toast, submit } = setup({ source: 'steam', mode: 'confirm', confirmWith: failWith(409, 'SYNC_IN_PROGRESS') });
    submit();
    expect(toast.error).toHaveBeenCalledWith('steam.errors.syncInProgress');
  });
});

describe('coverNeedsWarning', () => {
  it('warns only for a previewed cover that is not portrait', () => {
    expect(coverNeedsWarning('https://x/c.jpg', false)).toBe(true);
    expect(coverNeedsWarning('https://x/c.jpg', true)).toBe(false);
    expect(coverNeedsWarning(null, false)).toBe(false);
  });
});
