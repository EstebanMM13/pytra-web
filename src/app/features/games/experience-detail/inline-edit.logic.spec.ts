import { bumpHoursDraft, inlineDraft, parseInlineEdit } from './inline-edit.logic';

describe('run inline edit logic', () => {
  const run = { hours: 12.5, rating: 8.5 };

  it('starts from the stored value formatted like the run form', () => {
    expect(inlineDraft('hours', { hours: 0.316666, rating: null }, 'es')).toBe('0,32');
    expect(inlineDraft('hours', { hours: 12.5, rating: null }, 'en')).toBe('12.5');
    expect(inlineDraft('rating', { hours: 0, rating: 9.25 }, 'es')).toBe('9,25');
    expect(inlineDraft('rating', { hours: 0, rating: null }, 'es')).toBe('');
  });

  describe('hours', () => {
    it('accepts 0 or more with either separator', () => {
      expect(parseInlineEdit('hours', '13,25', run, 'hundredths')).toEqual({ kind: 'change', patch: { hours: 13.25 } });
      expect(parseInlineEdit('hours', '0', run, 'hundredths')).toEqual({ kind: 'change', patch: { hours: 0 } });
    });

    it('rejects negative or unparsable hours', () => {
      expect(parseInlineEdit('hours', '-1', run, 'hundredths')).toEqual({ kind: 'invalid' });
      expect(parseInlineEdit('hours', 'doce', run, 'hundredths')).toEqual({ kind: 'invalid' });
    });

    it('treats the stored value (at two decimals) and empty text as unchanged', () => {
      expect(parseInlineEdit('hours', '12,5', run, 'hundredths')).toEqual({ kind: 'unchanged' });
      expect(parseInlineEdit('hours', '0,32', { hours: 0.316666, rating: null }, 'hundredths')).toEqual({
        kind: 'unchanged',
      });
      expect(parseInlineEdit('hours', '  ', run, 'hundredths')).toEqual({ kind: 'unchanged' });
    });
  });

  describe('rating', () => {
    it('follows the rating precision', () => {
      expect(parseInlineEdit('rating', '9,25', run, 'hundredths')).toEqual({ kind: 'change', patch: { rating: 9.25 } });
      expect(parseInlineEdit('rating', '9,25', run, 'half')).toEqual({ kind: 'invalid' });
      expect(parseInlineEdit('rating', '9.5', run, 'half')).toEqual({ kind: 'change', patch: { rating: 9.5 } });
      expect(parseInlineEdit('rating', '9.5', run, 'integer')).toEqual({ kind: 'invalid' });
    });

    it('rejects values outside 0 to 10 and text', () => {
      expect(parseInlineEdit('rating', '10,5', run, 'hundredths')).toEqual({ kind: 'invalid' });
      expect(parseInlineEdit('rating', '-1', run, 'hundredths')).toEqual({ kind: 'invalid' });
      expect(parseInlineEdit('rating', 'nueve', run, 'hundredths')).toEqual({ kind: 'invalid' });
    });

    it('clears the rating with empty text and keeps an untouched one', () => {
      expect(parseInlineEdit('rating', '', run, 'hundredths')).toEqual({ kind: 'change', patch: { rating: null } });
      expect(parseInlineEdit('rating', '', { hours: 1, rating: null }, 'hundredths')).toEqual({ kind: 'unchanged' });
      // A stored rating stays accepted even if the precision preference changed since.
      expect(parseInlineEdit('rating', '8,5', run, 'integer')).toEqual({ kind: 'unchanged' });
    });
  });

  it('bumps the typed hours, or the stored ones when the text is empty or invalid', () => {
    expect(bumpHoursDraft('12,5', 12.5, 0.5, 'es')).toBe('13');
    expect(bumpHoursDraft('3', 12.5, 1, 'en')).toBe('4');
    expect(bumpHoursDraft('', 0.316666, 0.5, 'es')).toBe('0,82');
    expect(bumpHoursDraft('abc', null, 1, 'en')).toBe('1');
  });
});
