import { HttpErrorResponse } from '@angular/common/http';
import { Genre } from '../../../core/models/genre.model';
import { genreKey, matchGenres, steamAutofillErrorKey } from './steam-autofill.logic';

const genre = (id: number, name: string): Genre => ({ id, name });

describe('steam autofill logic', () => {
  it('builds accent-, case- and space-insensitive genre keys', () => {
    expect(genreKey('Acción')).toBe('ACCION');
    expect(genreKey('  mundo   abierto ')).toBe('MUNDO ABIERTO');
    expect(genreKey('SIMULACIÓN')).toBe('SIMULACION');
  });

  it('matches Steam genres to user genres stored upper-case, with or without accents', () => {
    const user = [genre(1, 'ACCIÓN'), genre(2, 'AVENTURA'), genre(3, 'PUZZLE')];

    const { matched, unmatched } = matchGenres(['Acción', 'Aventura', 'Indie'], user);

    expect(matched.map((g) => g.id)).toEqual([1, 2]);
    expect(unmatched).toEqual(['Indie']);
  });

  it('matches user genres saved without accents', () => {
    expect(matchGenres(['Acción'], [genre(7, 'ACCION')]).matched.map((g) => g.id)).toEqual([7]);
  });

  it('uses well-known aliases (Rol -> RPG, Acción -> ACTION)', () => {
    const user = [genre(1, 'RPG'), genre(2, 'ACTION')];

    const { matched, unmatched } = matchGenres(['Rol', 'Acción'], user);

    expect(matched.map((g) => g.id)).toEqual([1, 2]);
    expect(unmatched).toEqual([]);
  });

  it('prefers the exact genre over an alias and never repeats a genre', () => {
    const user = [genre(1, 'RPG'), genre(2, 'ROL')];

    expect(matchGenres(['Rol', 'rol', 'ROL '], user).matched.map((g) => g.id)).toEqual([2]);
  });

  it('dedupes and trims unmatched names and ignores blanks', () => {
    expect(matchGenres([' Indie ', 'indie', '', '  '], []).unmatched).toEqual(['Indie']);
  });

  it('works when the user has no genres yet', () => {
    expect(matchGenres(['Acción', 'Rol'], [])).toEqual({ matched: [], unmatched: ['Acción', 'Rol'] });
  });

  it('maps API error codes to translation keys', () => {
    const err = (status: number, message?: string) => new HttpErrorResponse({ status, error: { message } });
    expect(steamAutofillErrorKey(err(404, 'STEAM_APP_NOT_FOUND'))).toBe('game.steamAutofill.errors.notFound');
    expect(steamAutofillErrorKey(err(422, 'STEAM_APP_NOT_A_GAME'))).toBe('game.steamAutofill.errors.notAGame');
    expect(steamAutofillErrorKey(err(503, 'STEAM_UNAVAILABLE'))).toBe('game.steamAutofill.errors.unavailable');
    expect(steamAutofillErrorKey(err(0))).toBe('game.steamAutofill.errors.unavailable');
    expect(steamAutofillErrorKey(new Error('boom'))).toBe('game.steamAutofill.errors.unavailable');
  });
});
