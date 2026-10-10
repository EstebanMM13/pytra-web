import { FormControl, FormGroup } from '@angular/forms';
import {
  RunFormValue,
  buildExperienceRequest,
  dateRangeValidator,
  deriveRunYear,
  hoursValidator,
  isValidDateRange,
  isValidRating,
  nextRunLabel,
  ratingValidator,
  ratingValidatorFor,
} from './run-form.logic';

describe('run form logic', () => {
  describe('nextRunLabel', () => {
    it('numbers the next run after the existing ones', () => {
      expect(nextRunLabel(0)).toBe('Run 1');
      expect(nextRunLabel(2)).toBe('Run 3');
    });
  });

  describe('rating', () => {
    it('accepts empty and 0–10 with up to two decimals', () => {
      for (const value of [null, undefined, 0, 7, 9.5, 9.25, 10]) {
        expect(isValidRating(value)).toBe(true);
      }
    });

    it('rejects out-of-range values and extra decimals', () => {
      for (const value of [-0.01, 10.01, 11, 9.125, Number.NaN]) {
        expect(isValidRating(value)).toBe(false);
      }
    });

    it('is exposed as a control validator over the typed text', () => {
      expect(ratingValidator(new FormControl('8,75'))).toBeNull();
      expect(ratingValidator(new FormControl('9.5'))).toBeNull();
      expect(ratingValidator(new FormControl(''))).toBeNull();
      expect(ratingValidator(new FormControl('12'))).toEqual({ rating: true });
      expect(ratingValidator(new FormControl('abc'))).toEqual({ rating: true });
      expect(ratingValidator(new FormControl('9,125'))).toEqual({ rating: true });
    });

    it('enforces the rating precision preference', () => {
      expect(isValidRating(9, 'integer')).toBe(true);
      expect(isValidRating(9.5, 'integer')).toBe(false);
      expect(isValidRating(9.5, 'half')).toBe(true);
      expect(isValidRating(9.25, 'half')).toBe(false);
      expect(isValidRating(9.25, 'hundredths')).toBe(true);

      const half = ratingValidatorFor(() => 'half');
      expect(half(new FormControl('9,5'))).toBeNull();
      expect(half(new FormControl('9,25'))).toEqual({ rating: true });
    });

    it('keeps accepting the stored rating of the run being edited', () => {
      const integer = ratingValidatorFor(() => 'integer', () => 9.25);
      expect(integer(new FormControl('9,25'))).toBeNull();
      expect(integer(new FormControl('9,5'))).toEqual({ rating: true });
    });
  });

  describe('hours', () => {
    it('allows empty and non-negative values only', () => {
      expect(hoursValidator(new FormControl(''))).toBeNull();
      expect(hoursValidator(new FormControl('0'))).toBeNull();
      expect(hoursValidator(new FormControl('12,5'))).toBeNull();
      expect(hoursValidator(new FormControl('-1'))).toEqual({ hours: true });
      expect(hoursValidator(new FormControl('doce'))).toEqual({ hours: true });
    });
  });

  describe('date range', () => {
    it('requires end on or after start when both are set', () => {
      expect(isValidDateRange('2024-01-10', '2024-01-10')).toBe(true);
      expect(isValidDateRange('2024-01-10', '2024-03-01')).toBe(true);
      expect(isValidDateRange('2024-01-10', '2023-12-31')).toBe(false);
      expect(isValidDateRange('', '2023-12-31')).toBe(true);
      expect(isValidDateRange('2024-01-10', null)).toBe(true);
    });

    it('is exposed as a group validator', () => {
      const group = new FormGroup({
        startDate: new FormControl('2024-05-01'),
        endDate: new FormControl('2024-04-01'),
      });
      expect(dateRangeValidator(group)).toEqual({ dateRange: true });
      group.controls.endDate.setValue('2024-06-01');
      expect(dateRangeValidator(group)).toBeNull();
    });
  });

  describe('deriveRunYear', () => {
    it('uses the end date, then the start date', () => {
      expect(deriveRunYear({ startDate: '2023-02-25', endDate: '2024-06-30' })).toBe(2024);
      expect(deriveRunYear({ startDate: '2023-02-25', endDate: null })).toBe(2023);
      expect(deriveRunYear({ startDate: null, endDate: null })).toBeNull();
    });

    it('keeps the stored year when editing without touching the dates', () => {
      const original = { year: 2019, startDate: '2020-01-05', endDate: null };
      expect(deriveRunYear({ startDate: '2020-01-05', endDate: null }, original)).toBe(2019);
    });

    it('re-derives when the dates change, falling back to the stored year', () => {
      const original = { year: 2019, startDate: null, endDate: null };
      expect(deriveRunYear({ startDate: null, endDate: '2025-02-01' }, original)).toBe(2025);
      expect(deriveRunYear({ startDate: null, endDate: null }, { ...original, startDate: '2019-03-01' })).toBe(2019);
    });
  });

  describe('buildExperienceRequest', () => {
    const value: RunFormValue = {
      runLabel: '  Run 2 ',
      status: 'COMPLETADO',
      platform: 'SWITCH',
      startDate: '2025-01-10',
      endDate: '2025-04-02',
      hours: '27',
      rating: '9,5',
      summary: '  ',
      platinum: true,
      replay: true,
      pros: 'Combate\nArte',
      cons: '',
      notes: '',
    };

    it('trims text, nulls empty fields and derives the year', () => {
      expect(buildExperienceRequest(value)).toEqual({
        runLabel: 'Run 2',
        year: 2025,
        status: 'COMPLETADO',
        rating: 9.5,
        hours: 27,
        startDate: '2025-01-10',
        endDate: '2025-04-02',
        platform: 'SWITCH',
        platinum: true,
        replay: true,
        summary: null,
        pros: 'Combate\nArte',
        cons: null,
        notes: null,
      });
    });

    it('parses comma decimals and sends null for empty numbers', () => {
      const request = buildExperienceRequest({ ...value, rating: '9,25', hours: '12.5' });
      expect(request.rating).toBe(9.25);
      expect(request.hours).toBe(12.5);
      const empty = buildExperienceRequest({ ...value, rating: '', hours: ' ' });
      expect(empty.rating).toBeNull();
      expect(empty.hours).toBeNull();
    });

    it('sends null dates when they are empty', () => {
      const request = buildExperienceRequest({ ...value, startDate: '', endDate: '' });
      expect(request.startDate).toBeNull();
      expect(request.endDate).toBeNull();
      expect(request.year).toBeNull();
    });
  });
});
