import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { IgdbGameMetadata, IgdbSearchResult } from '../../../core/models/igdb-metadata.model';
import { SteamGameMetadata, SteamStoreSearchResult } from '../../../core/models/steam-metadata.model';
import { IgdbMetadataService } from '../../../core/services/igdb-metadata.service';
import { SteamMetadataService } from '../../../core/services/steam-metadata.service';
import { AUTOFILL_SEARCH_DEBOUNCE_MS, MetadataAutofill } from './metadata-autofill';

const STEAM_RESULTS: SteamStoreSearchResult[] = [
  { appId: 1245620, name: 'ELDEN RING', imageUrl: 'https://shared.akamai.steamstatic.com/a.jpg' },
  { appId: 2622380, name: 'ELDEN RING NIGHTREIGN', imageUrl: null },
];

const STEAM_METADATA: SteamGameMetadata = {
  steamAppId: 2622380,
  name: 'ELDEN RING NIGHTREIGN',
  developer: 'FromSoftware, Inc.',
  publisher: 'Bandai Namco Entertainment',
  releaseDate: '2025-05-30',
  genres: ['Acción'],
  coverImageUrl: 'https://shared.akamai.steamstatic.com/h.jpg',
};

const IGDB_RESULTS: IgdbSearchResult[] = [
  {
    igdbId: 119388,
    name: 'The Legend of Zelda: Tears of the Kingdom',
    year: 2023,
    imageUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_small/co5vmg.jpg',
    platforms: ['Switch'],
  },
];

const IGDB_METADATA: IgdbGameMetadata = {
  igdbId: 119388,
  name: 'The Legend of Zelda: Tears of the Kingdom',
  developer: 'Nintendo EPD Production Group No. 3',
  publisher: 'Nintendo',
  releaseDate: '2023-05-12',
  genres: ['Adventure'],
  coverImageUrl: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/ar1.jpg',
  platforms: ['Nintendo Switch'],
};

type ServiceStub<T> = Partial<Record<keyof T, unknown>>;

describe('MetadataAutofill', () => {
  afterEach(() => vi.useRealTimers());

  function setup(
    steam: ServiceStub<SteamMetadataService>,
    igdb: ServiceStub<IgdbMetadataService> = {},
    igdbEnabled = false,
  ) {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [MetadataAutofill],
      providers: [
        provideTranslateService(),
        { provide: SteamMetadataService, useValue: steam },
        { provide: IgdbMetadataService, useValue: igdb },
      ],
    });
    const fixture = TestBed.createComponent(MetadataAutofill);
    fixture.componentRef.setInput('igdbEnabled', igdbEnabled);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input')!;
    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(AUTOFILL_SEARCH_DEBOUNCE_MS);
      fixture.detectChanges();
    };
    const key = (k: string) => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };
    const status = () => el.querySelector('#autofill-status')?.textContent ?? '';
    const radios = () => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    return { fixture, el, input, type, key, status, radios };
  }

  it('debounces the search and lists results with their images', () => {
    const search = vi.fn(() => of(STEAM_RESULTS));
    const { el, input, type } = setup({ search });

    input.value = 'el';
    input.dispatchEvent(new Event('input'));
    expect(search).not.toHaveBeenCalled();
    type('elden');

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('elden');
    const options = el.querySelectorAll('[role="option"]');
    expect(options.length).toBe(2);
    expect(options[0].querySelector('img')?.getAttribute('src')).toBe(
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/library_600x900.jpg',
    );
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('hides the source switch and uses Steam when IGDB is disabled', () => {
    const { radios } = setup({ search: () => of([]) }, {}, false);

    expect(radios().length).toBe(0);
  });

  it('does not search below the minimum length', () => {
    const search = vi.fn(() => of(STEAM_RESULTS));
    const { type } = setup({ search });

    type(' e ');

    expect(search).not.toHaveBeenCalled();
  });

  it('shows the empty state', () => {
    const { status, type } = setup({ search: () => of([]) });

    type('zzzz');

    expect(status()).toContain('game.autofill.empty');
  });

  it('shows an error when the source is unavailable', () => {
    const { el, status, type } = setup({
      search: () => throwError(() => new HttpErrorResponse({ status: 503, error: { message: 'STEAM_UNAVAILABLE' } })),
    });

    type('elden');

    expect(status()).toContain('game.autofill.errors.unavailable');
    expect(el.querySelectorAll('[role="option"]').length).toBe(0);
  });

  it('picks with the keyboard and emits the details with their source', () => {
    const getDetails = vi.fn(() => of(STEAM_METADATA));
    const { fixture, key, type } = setup({ search: () => of(STEAM_RESULTS), getDetails });
    const picked = vi.fn();
    fixture.componentInstance.picked.subscribe(picked);

    type('elden');
    key('ArrowDown');
    key('Enter');

    expect(getDetails).toHaveBeenCalledWith(2622380);
    expect(picked).toHaveBeenCalledWith({ source: 'steam', metadata: STEAM_METADATA });
  });

  it('keeps the list open and explains a DLC pick', () => {
    const { fixture, el, status, type } = setup({
      search: () => of(STEAM_RESULTS),
      getDetails: () =>
        throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'STEAM_APP_NOT_A_GAME' } })),
    });
    const picked = vi.fn();
    fixture.componentInstance.picked.subscribe(picked);

    type('elden');
    (el.querySelector('[role="option"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(picked).not.toHaveBeenCalled();
    expect(status()).toContain('game.autofill.errors.notAGame');
    expect(el.querySelectorAll('[role="option"]').length).toBe(2);
  });

  it('defaults to IGDB when enabled and shows year and platforms', () => {
    const steamSearch = vi.fn(() => of(STEAM_RESULTS));
    const igdbSearch = vi.fn(() => of(IGDB_RESULTS));
    const getDetails = vi.fn(() => of(IGDB_METADATA));
    const { fixture, el, type, radios } = setup({ search: steamSearch }, { search: igdbSearch, getDetails }, true);
    const picked = vi.fn();
    fixture.componentInstance.picked.subscribe(picked);

    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    type('zelda');

    expect(igdbSearch).toHaveBeenCalledWith('zelda');
    expect(steamSearch).not.toHaveBeenCalled();
    const option = el.querySelector('[role="option"]') as HTMLElement;
    expect(option.textContent).toContain('2023 · Switch');
    expect(option.querySelector('img')?.getAttribute('src')).toBe(IGDB_RESULTS[0].imageUrl);

    option.click();
    expect(getDetails).toHaveBeenCalledWith(119388);
    expect(picked).toHaveBeenCalledWith({ source: 'igdb', metadata: IGDB_METADATA });
  });

  it('searches the same query again when switching source', () => {
    const steamSearch = vi.fn(() => of(STEAM_RESULTS));
    const igdbSearch = vi.fn(() => of(IGDB_RESULTS));
    const { fixture, el, type, radios } = setup({ search: steamSearch }, { search: igdbSearch }, true);

    type('elden');
    radios()[1].click();
    vi.advanceTimersByTime(AUTOFILL_SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();

    expect(steamSearch).toHaveBeenCalledWith('elden');
    expect(el.querySelectorAll('[role="option"]').length).toBe(2);

    radios()[0].click();
    vi.advanceTimersByTime(AUTOFILL_SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();

    expect(igdbSearch).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll('[role="option"]').length).toBe(1);
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
