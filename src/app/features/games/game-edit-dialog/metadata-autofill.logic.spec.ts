import { HttpErrorResponse } from '@angular/common/http';
import { Genre } from '../../../core/models/genre.model';
import {
  autofillErrorKey,
  fromIgdbResult,
  fromSteamResult,
  genreKey,
  matchGenres,
  resultDetails,
} from './metadata-autofill.logic';

const genre = (id: number, name: string): Genre => ({ id, name });

describe('metadata autofill logic', () => {
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

  it("maps IGDB's English genres onto the user's Spanish ones", () => {
    const user = [
      genre(1, 'RPG'),
      genre(2, 'AVENTURA'),
      genre(3, 'PLATAFORMAS'),
      genre(4, 'PUZLES'),
      genre(5, 'CARRERAS'),
      genre(6, 'DEPORTES'),
      genre(7, 'HACK AND SLASH'),
      genre(8, 'AVENTURA GRÁFICA'),
      genre(9, 'CARTAS'),
      genre(10, 'ARCADE'),
      genre(11, 'TURNOS'),
    ];

    const { matched, unmatched } = matchGenres(
      [
        'Role-playing (RPG)',
        'Adventure',
        'Platform',
        'Puzzle',
        'Racing',
        'Sport',
        "Hack and slash/Beat 'em up",
        'Point-and-click',
        'Card & Board Game',
        'Arcade',
        'Turn-based strategy (TBS)',
      ],
      user,
    );

    expect(matched.map((g) => g.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(unmatched).toEqual([]);
  });

  it("matches IGDB's beat 'em up to a user BEAT 'EM UP genre", () => {
    const { matched } = matchGenres(["Hack and slash/Beat 'em up"], [genre(1, "BEAT 'EM UP")]);

    expect(matched.map((g) => g.id)).toEqual([1]);
  });

  it('suggests Spanish names for unmatched IGDB genres, once each', () => {
    const { unmatched } = matchGenres(
      ['Role-playing (RPG)', 'Strategy', 'Real Time Strategy (RTS)', 'Indie', 'Fighting', 'Simulator', 'MOBA'],
      [],
    );

    expect(unmatched).toEqual(['Rol', 'Estrategia', 'Estrategia en tiempo real', 'Indie', 'Lucha', 'Simulación', 'MOBA']);
  });

  it('prefers the specific Spanish genre over the generic one for strategy subgenres', () => {
    const user = [genre(1, 'ESTRATEGIA'), genre(2, 'ESTRATEGIA POR TURNOS')];

    expect(matchGenres(['Turn-based strategy (TBS)'], user).matched.map((g) => g.id)).toEqual([2]);
    expect(matchGenres(['Real Time Strategy (RTS)'], user).matched.map((g) => g.id)).toEqual([1]);
  });

  it('normalizes search hits of both sources', () => {
    expect(fromSteamResult({ appId: 620, name: 'Portal 2', imageUrl: null })).toEqual({
      id: 620,
      name: 'Portal 2',
      imageUrl: null,
      year: null,
      platforms: [],
    });
    expect(
      fromIgdbResult({ igdbId: 7, name: 'Knack', year: 2013, imageUrl: 'https://images.igdb.com/k.jpg', platforms: ['PS4'] }),
    ).toEqual({ id: 7, name: 'Knack', imageUrl: 'https://images.igdb.com/k.jpg', year: 2013, platforms: ['PS4'] });
  });

  it('describes a result with its year and platforms', () => {
    const base = { id: 1, name: 'x', imageUrl: null };
    expect(resultDetails({ ...base, year: 2017, platforms: ['Switch', 'Wii U'] })).toBe('2017 · Switch, Wii U');
    expect(resultDetails({ ...base, year: null, platforms: ['PS5'] })).toBe('PS5');
    expect(resultDetails({ ...base, year: 2005, platforms: [] })).toBe('2005');
    expect(resultDetails({ ...base, year: null, platforms: [] })).toBe('');
  });

  it('maps API error codes to translation keys', () => {
    const err = (status: number, message?: string) => new HttpErrorResponse({ status, error: { message } });
    expect(autofillErrorKey(err(404, 'STEAM_APP_NOT_FOUND'))).toBe('game.autofill.errors.notFound');
    expect(autofillErrorKey(err(404, 'IGDB_GAME_NOT_FOUND'))).toBe('game.autofill.errors.notFound');
    expect(autofillErrorKey(err(422, 'STEAM_APP_NOT_A_GAME'))).toBe('game.autofill.errors.notAGame');
    expect(autofillErrorKey(err(503, 'STEAM_UNAVAILABLE'))).toBe('game.autofill.errors.unavailable');
    expect(autofillErrorKey(err(503, 'IGDB_UNAVAILABLE'))).toBe('game.autofill.errors.unavailable');
    expect(autofillErrorKey(err(404, 'IGDB_DISABLED'))).toBe('game.autofill.errors.unavailable');
    expect(autofillErrorKey(err(0))).toBe('game.autofill.errors.unavailable');
    expect(autofillErrorKey(new Error('boom'))).toBe('game.autofill.errors.unavailable');
  });
});
