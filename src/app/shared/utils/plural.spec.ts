import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { hasTranslationKey, pluralKey, translatePlural } from './plural';

describe('pluralKey', () => {
  const withOne = (key: string) => key === 'common.games_one';
  const none = () => false;

  for (const lang of ['es', 'en']) {
    it(`uses the _one key only for 1 (${lang})`, () => {
      expect(pluralKey('common.games', 0, lang, withOne)).toBe('common.games');
      expect(pluralKey('common.games', 1, lang, withOne)).toBe('common.games_one');
      expect(pluralKey('common.games', 2, lang, withOne)).toBe('common.games');
    });
  }

  it('falls back to the base key when the _one variant does not exist', () => {
    expect(pluralKey('common.games', 1, 'es', none)).toBe('common.games');
  });

  it('uses an explicit _other variant when present', () => {
    const has = (key: string) => key === 'x_one' || key === 'x_other';
    expect(pluralKey('x', 3, 'en', has)).toBe('x_other');
  });

  it('keeps the key without a count or language', () => {
    expect(pluralKey('common.games', null, 'es', withOne)).toBe('common.games');
    expect(pluralKey('common.games', undefined, 'es', withOne)).toBe('common.games');
    expect(pluralKey('common.games', 1, null, withOne)).toBe('common.games_one');
  });
});

describe('hasTranslationKey', () => {
  const translations = { common: { games: '{{count}} juegos', nested: { a: 'A' } } };

  it('resolves dotted keys to leaf values only', () => {
    expect(hasTranslationKey(translations, 'common.games')).toBe(true);
    expect(hasTranslationKey(translations, 'common.nested.a')).toBe(true);
    expect(hasTranslationKey(translations, 'common.nested')).toBe(false);
    expect(hasTranslationKey(translations, 'common.games_one')).toBe(false);
    expect(hasTranslationKey(undefined, 'common.games')).toBe(false);
  });
});

describe('translatePlural', () => {
  it('translates with count in es and en', () => {
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { common: { games: '{{count}} juegos', games_one: '{{count}} juego' } });
    translate.setTranslation('en', { common: { games: '{{count}} games', games_one: '{{count}} game' } });

    translate.use('es');
    expect([0, 1, 2].map((n) => translatePlural(translate, 'common.games', n))).toEqual([
      '0 juegos',
      '1 juego',
      '2 juegos',
    ]);
    translate.use('en');
    expect([0, 1, 2].map((n) => translatePlural(translate, 'common.games', n))).toEqual([
      '0 games',
      '1 game',
      '2 games',
    ]);
  });
});
