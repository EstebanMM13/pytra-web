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
  postgameForEndDate,
  postgameRangeValidator,
  ratingValidator,
  canStartRun,
  ratingValidatorFor,
  runDateValidator,
  statusForEndDate,
} from './run-form.logic';

describe('run form logic', () => {
  describe('statusForEndDate', () => {
    const today = '2026-10-15';

    it('completes a run in progress or pending when an end date up to today is set', () => {
      expect(statusForEndDate('EN_CURSO', '2026-10-01', today)).toBe('COMPLETADO');
      expect(statusForEndDate('PENDIENTE', '2026-10-15', today)).toBe('COMPLETADO');
    });

    it('does not complete a run for a future end date', () => {
      expect(statusForEndDate('EN_CURSO', '2026-10-16', today)).toBe('EN_CURSO');
      expect(statusForEndDate('PENDIENTE', '2027-01-01', today)).toBe('PENDIENTE');
    });

    it('reopens a completed run when its end date is cleared', () => {
      expect(statusForEndDate('COMPLETADO', '', today)).toBe('EN_CURSO');
      expect(statusForEndDate('COMPLETADO', null, today)).toBe('EN_CURSO');
    });

    it('keeps a completed run completed when its end date moves', () => {
      expect(statusForEndDate('COMPLETADO', '2026-09-30', today)).toBe('COMPLETADO');
    });

    it('never changes an abandoned run', () => {
      expect(statusForEndDate('ABANDONADO', '2026-10-01', today)).toBe('ABANDONADO');
      expect(statusForEndDate('ABANDONADO', '', today)).toBe('ABANDONADO');
    });

    it('leaves runs without an end date in progress or pending', () => {
      expect(statusForEndDate('EN_CURSO', '', today)).toBe('EN_CURSO');
      expect(statusForEndDate('PENDIENTE', null, today)).toBe('PENDIENTE');
    });
  });

  describe('canStartRun', () => {
    it('offers new runs for every category but ONLINE', () => {
      expect(canStartRun({ category: 'SINGLEPLAYER' })).toBe(true);
      expect(canStartRun({ category: 'HYBRID' })).toBe(true);
      expect(canStartRun({ category: null })).toBe(true);
      expect(canStartRun({ category: 'ONLINE' })).toBe(false);
    });
  });

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

    it('validates the typed text on the rating scale', () => {
      const hundred = ratingValidatorFor(() => 'integer', () => null, () => '100');
      expect(hundred(new FormControl('87'))).toBeNull();
      expect(hundred(new FormControl('100'))).toBeNull();
      expect(hundred(new FormControl('87,5'))).toEqual({ rating: true });
      expect(hundred(new FormControl('101'))).toEqual({ rating: true });

      const five = ratingValidatorFor(() => 'hundredths', () => null, () => '5');
      expect(five(new FormControl('4,25'))).toBeNull();
      expect(five(new FormControl('5'))).toBeNull();
      expect(five(new FormControl('5,5'))).toEqual({ rating: true });
      expect(five(new FormControl('4,255'))).toEqual({ rating: true });
    });

    it('keeps accepting the stored rating shown on another scale', () => {
      // Stored 8.75 shows as 87.5 on 0–100: saving it untouched works with integer precision.
      const hundred = ratingValidatorFor(() => 'integer', () => 8.75, () => '100');
      expect(hundred(new FormControl('87,5'))).toBeNull();
      expect(hundred(new FormControl('86,5'))).toEqual({ rating: true });
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

    it('rejects dates before 1970 or after tomorrow on each date input', () => {
      expect(runDateValidator(new FormControl(''))).toBeNull();
      expect(runDateValidator(new FormControl('2024-05-01'))).toBeNull();
      expect(runDateValidator(new FormControl('1969-12-31'))).toEqual({ runDate: true });
      expect(runDateValidator(new FormControl('9999-01-01'))).toEqual({ runDate: true });
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

    it('requires the postgame end on or after the end date', () => {
      const group = new FormGroup({
        endDate: new FormControl('2024-05-10'),
        postgameEndDate: new FormControl('2024-05-09'),
      });
      expect(postgameRangeValidator(group)).toEqual({ postgameRange: true });
      group.controls.postgameEndDate.setValue('2024-05-10');
      expect(postgameRangeValidator(group)).toBeNull();
      group.controls.endDate.setValue('');
      group.controls.postgameEndDate.setValue('2024-05-09');
      expect(postgameRangeValidator(group)).toBeNull();
    });

    it('ignores the hidden postgame end date when the run is not completed', () => {
      const group = new FormGroup({
        status: new FormControl('COMPLETADO'),
        endDate: new FormControl('2024-05-10'),
        postgameEndDate: new FormControl('2024-05-09'),
      });
      expect(postgameRangeValidator(group)).toEqual({ postgameRange: true });
      group.controls.status.setValue('ABANDONADO');
      expect(postgameRangeValidator(group)).toBeNull();
    });
  });

  describe('postgameForEndDate', () => {
    it('ends the postgame when its end date is set and resumes it when the date is cleared', () => {
      expect(postgameForEndDate('2026-10-01')).toBe(false);
      expect(postgameForEndDate('')).toBe(true);
      expect(postgameForEndDate(null)).toBe(true);
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
      platformId: 14,
      startDate: '2025-01-10',
      endDate: '2025-04-02',
      hours: '27',
      rating: '9,5',
      summary: '  ',
      platinum: true,
      fullCompletion: false,
      replay: true,
      postgame: false,
      postgameEndDate: '',
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
        platformId: 14,
        platinum: true,
        fullCompletion: false,
        replay: true,
        postgame: false,
        postgameEndDate: null,
        summary: null,
        pros: 'Combate\nArte',
        cons: null,
        notes: null,
      });
    });

    it('sends the postgame of a completed run, and its end date ends it', () => {
      expect(buildExperienceRequest({ ...value, postgame: true })).toMatchObject({
        postgame: true,
        postgameEndDate: null,
      });
      expect(buildExperienceRequest({ ...value, postgame: true, postgameEndDate: '2025-06-01' })).toMatchObject({
        postgame: false,
        postgameEndDate: '2025-06-01',
      });
    });

    it('drops the postgame and its end date when the run is not completed', () => {
      for (const status of ['EN_CURSO', 'ABANDONADO', 'PENDIENTE'] as const) {
        expect(buildExperienceRequest({ ...value, status, postgame: true, postgameEndDate: '2025-06-01' })).toMatchObject({
          postgame: false,
          postgameEndDate: null,
        });
      }
    });

    it('sends the 100% flag independently of the platinum', () => {
      expect(buildExperienceRequest({ ...value, platinum: false, fullCompletion: true })).toMatchObject({
        platinum: false,
        fullCompletion: true,
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

    it('sends the rating on the stored 0–10 scale', () => {
      expect(buildExperienceRequest({ ...value, rating: '87' }, null, '100').rating).toBe(8.7);
      expect(buildExperienceRequest({ ...value, rating: '87,5' }, null, '100').rating).toBe(8.75);
      expect(buildExperienceRequest({ ...value, rating: '4,3' }, null, '5').rating).toBe(8.6);
      expect(buildExperienceRequest({ ...value, rating: '4.25' }, null, '5').rating).toBe(8.5);
      expect(buildExperienceRequest({ ...value, rating: '9,25' }, null, '10').rating).toBe(9.25);
      expect(buildExperienceRequest({ ...value, rating: '' }, null, '100').rating).toBeNull();
    });

    it('sends null dates when they are empty', () => {
      const request = buildExperienceRequest({ ...value, startDate: '', endDate: '' });
      expect(request.startDate).toBeNull();
      expect(request.endDate).toBeNull();
      expect(request.year).toBeNull();
    });
  });
});
