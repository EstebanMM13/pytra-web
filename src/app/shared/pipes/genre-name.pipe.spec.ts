import { GenreNamePipe, formatGenreName } from './genre-name.pipe';

describe('formatGenreName', () => {
  it('converts upper-cased names to sentence case', () => {
    expect(formatGenreName('MUNDO ABIERTO')).toBe('Mundo abierto');
    expect(formatGenreName('SOULSLIKE')).toBe('Soulslike');
    expect(formatGenreName('ACCIÓN')).toBe('Acción');
  });

  it('keeps known acronyms and words with digits upper case', () => {
    expect(formatGenreName('RPG')).toBe('RPG');
    expect(formatGenreName('ACTION RPG')).toBe('Action RPG');
    expect(formatGenreName('PLATAFORMAS 2D')).toBe('Plataformas 2D');
  });

  it('handles punctuation between words', () => {
    expect(formatGenreName('ROGUE-LIKE')).toBe('Rogue-like');
    expect(formatGenreName('HACK AND SLASH')).toBe('Hack and slash');
  });
});

describe('GenreNamePipe', () => {
  const pipe = new GenreNamePipe();

  it('renders missing values as an empty string', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
