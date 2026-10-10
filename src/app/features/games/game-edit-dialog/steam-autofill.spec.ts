import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SteamGameMetadata, SteamStoreSearchResult } from '../../../core/models/steam-metadata.model';
import { SteamMetadataService } from '../../../core/services/steam-metadata.service';
import { STEAM_SEARCH_DEBOUNCE_MS, SteamAutofill } from './steam-autofill';

const RESULTS: SteamStoreSearchResult[] = [
  { appId: 1245620, name: 'ELDEN RING', imageUrl: 'https://shared.akamai.steamstatic.com/a.jpg' },
  { appId: 2622380, name: 'ELDEN RING NIGHTREIGN', imageUrl: null },
];

const METADATA: SteamGameMetadata = {
  steamAppId: 2622380,
  name: 'ELDEN RING NIGHTREIGN',
  developer: 'FromSoftware, Inc.',
  publisher: 'Bandai Namco Entertainment',
  releaseDate: '2025-05-30',
  genres: ['Acción'],
  coverImageUrl: 'https://shared.akamai.steamstatic.com/h.jpg',
};

describe('SteamAutofill', () => {
  afterEach(() => vi.useRealTimers());

  function setup(service: Partial<Record<keyof SteamMetadataService, unknown>>) {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [SteamAutofill],
      providers: [provideTranslateService(), { provide: SteamMetadataService, useValue: service }],
    });
    const fixture = TestBed.createComponent(SteamAutofill);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input')!;
    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(STEAM_SEARCH_DEBOUNCE_MS);
      fixture.detectChanges();
    };
    const key = (k: string) => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };
    return { fixture, el, input, type, key };
  }

  it('debounces the search and lists results with their images', () => {
    const search = vi.fn(() => of(RESULTS));
    const { el, input, type } = setup({ search });

    input.value = 'el';
    input.dispatchEvent(new Event('input'));
    expect(search).not.toHaveBeenCalled();
    type('elden');

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('elden');
    const options = el.querySelectorAll('[role="option"]');
    expect(options.length).toBe(2);
    expect(options[0].querySelector('img')?.getAttribute('src')).toBe(RESULTS[0].imageUrl);
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not search below the minimum length', () => {
    const search = vi.fn(() => of(RESULTS));
    const { type } = setup({ search });

    type(' e ');

    expect(search).not.toHaveBeenCalled();
  });

  it('shows the empty state', () => {
    const { el, type } = setup({ search: () => of([]) });

    type('zzzz');

    expect(el.querySelector('#steam-autofill-status')?.textContent).toContain('game.steamAutofill.empty');
  });

  it('shows an error when Steam is unavailable', () => {
    const { el, type } = setup({
      search: () => throwError(() => new HttpErrorResponse({ status: 503, error: { message: 'STEAM_UNAVAILABLE' } })),
    });

    type('elden');

    expect(el.querySelector('#steam-autofill-status')?.textContent).toContain('game.steamAutofill.errors.unavailable');
    expect(el.querySelectorAll('[role="option"]').length).toBe(0);
  });

  it('picks with the keyboard and emits the details', () => {
    const getDetails = vi.fn(() => of(METADATA));
    const { fixture, key, type } = setup({ search: () => of(RESULTS), getDetails });
    const picked = vi.fn();
    fixture.componentInstance.picked.subscribe(picked);

    type('elden');
    key('ArrowDown');
    key('Enter');

    expect(getDetails).toHaveBeenCalledWith(2622380);
    expect(picked).toHaveBeenCalledWith(METADATA);
  });

  it('keeps the list open and explains a DLC pick', () => {
    const { fixture, el, type } = setup({
      search: () => of(RESULTS),
      getDetails: () =>
        throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'STEAM_APP_NOT_A_GAME' } })),
    });
    const picked = vi.fn();
    fixture.componentInstance.picked.subscribe(picked);

    type('elden');
    (el.querySelector('[role="option"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(picked).not.toHaveBeenCalled();
    expect(el.querySelector('#steam-autofill-status')?.textContent).toContain('game.steamAutofill.errors.notAGame');
    expect(el.querySelectorAll('[role="option"]').length).toBe(2);
  });

  it('closes on Escape without letting the dialog see it', () => {
    const { fixture, input } = setup({ search: () => of([]) });
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    input.dispatchEvent(event);

    expect(cancelled).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });
});
