import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { Genre } from '../../../core/models/genre.model';
import { Saga } from '../../../core/models/saga.model';
import { GameService } from '../../../core/services/game.service';
import { GenreService } from '../../../core/services/genre.service';
import { IgdbMetadataService } from '../../../core/services/igdb-metadata.service';
import { SagaService } from '../../../core/services/saga.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { GameEditDialog, coverNeedsWarning } from './game-edit-dialog';

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
    const el = fixture.nativeElement as HTMLElement;
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

describe('coverNeedsWarning', () => {
  it('warns only for a previewed cover that is not portrait', () => {
    expect(coverNeedsWarning('https://x/c.jpg', false)).toBe(true);
    expect(coverNeedsWarning('https://x/c.jpg', true)).toBe(false);
    expect(coverNeedsWarning(null, false)).toBe(false);
  });
});
