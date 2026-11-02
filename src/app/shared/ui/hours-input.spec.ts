import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { parseDecimal } from '../utils/decimal-input';
import { HoursInput, joinHours, splitHours } from './hours-input';

describe('splitHours', () => {
  it('splits decimal hours into whole hours and minutes', () => {
    expect(splitHours(0.77)).toEqual({ hours: '0', minutes: '46' });
    expect(splitHours(12)).toEqual({ hours: '12', minutes: '0' });
    expect(splitHours(12.5)).toEqual({ hours: '12', minutes: '30' });
    expect(splitHours(1.9999)).toEqual({ hours: '2', minutes: '0' });
  });

  it('leaves both fields empty without a value', () => {
    expect(splitHours(null)).toEqual({ hours: '', minutes: '' });
  });
});

describe('joinHours', () => {
  it('joins hours and minutes into decimal hours rounded to two decimals', () => {
    expect(joinHours('0', '46')).toBe(0.77);
    expect(joinHours('12', '30')).toBe(12.5);
    expect(joinHours('1', '59')).toBe(1.98);
    expect(joinHours('2', '')).toBe(2);
    expect(joinHours('', '30')).toBe(0.5);
  });

  it('is null when both fields are empty', () => {
    expect(joinHours('', '  ')).toBeNull();
  });

  it('is NaN for minutes outside 0-59, decimals or negative values', () => {
    expect(joinHours('1', '60')).toBeNaN();
    expect(joinHours('1', '5,5')).toBeNaN();
    expect(joinHours('1', '-1')).toBeNaN();
    expect(joinHours('-1', '0')).toBeNaN();
    expect(joinHours('abc', '')).toBeNaN();
  });
});

@Component({
  imports: [HoursInput, ReactiveFormsModule],
  template: `
    <app-hours-input inputId="form-hours" label="Hours" [formControl]="control" />
    <app-hours-input inputId="bound-hours" label="Bound" [(value)]="text" />
    <app-hours-input inputId="sized-hours" label="Sized" fieldClass="w-16" minutesFieldClass="w-10" />
  `,
})
class Host {
  readonly control = new FormControl('12,5');
  readonly text = signal('0,77');
}

describe('HoursInput', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [provideTranslateService({ lang: 'es', fallbackLang: 'es' })],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const fields = (id: string) => {
      const hours = el.querySelector<HTMLInputElement>(`#${id}`)!;
      const minutes = el.querySelector<HTMLInputElement>(`#${id}-min`)!;
      return { hours, minutes };
    };
    const type = (input: HTMLInputElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, host: fixture.componentInstance, fields, type };
  }

  it('gives both fields the field class unless the minutes have their own', () => {
    const { fields } = setup();
    expect(fields('form-hours').minutes.className).toBe(fields('form-hours').hours.className);
    expect(fields('sized-hours').hours.className).toBe('w-16');
    expect(fields('sized-hours').minutes.className).toBe('w-10');
  });

  it('loads a form value split into hours and minutes', () => {
    const { fields } = setup();
    expect(fields('form-hours').hours.value).toBe('12');
    expect(fields('form-hours').minutes.value).toBe('30');
  });

  it('writes decimal hours back to the form control', () => {
    const { host, fields, type } = setup();
    type(fields('form-hours').hours, '0');
    type(fields('form-hours').minutes, '46');
    expect(host.control.value).toBe('0,77');
    expect(parseDecimal(host.control.value)).toBe(0.77);
  });

  it('writes an unparsable value for invalid minutes so validators reject it', () => {
    const { host, fields, type } = setup();
    type(fields('form-hours').minutes, '75');
    expect(Number.isNaN(parseDecimal(host.control.value))).toBe(true);
  });

  it('writes empty when both fields are cleared', () => {
    const { host, fields, type } = setup();
    type(fields('form-hours').hours, '');
    type(fields('form-hours').minutes, '');
    expect(host.control.value).toBe('');
  });

  it('re-splits when the form sets a new value', () => {
    const { host, fixture, fields } = setup();
    host.control.setValue('3,25');
    fixture.detectChanges();
    expect(fields('form-hours').hours.value).toBe('3');
    expect(fields('form-hours').minutes.value).toBe('15');
  });

  it('supports two-way binding of the decimal text', () => {
    const { host, fixture, fields, type } = setup();
    expect(fields('bound-hours').hours.value).toBe('0');
    expect(fields('bound-hours').minutes.value).toBe('46');
    type(fields('bound-hours').hours, '1');
    expect(host.text()).toBe('1,77');
    host.text.set('2,5');
    fixture.detectChanges();
    expect(fields('bound-hours').hours.value).toBe('2');
    expect(fields('bound-hours').minutes.value).toBe('30');
  });

  it('labels both fields', () => {
    const { fields } = setup();
    expect(fields('form-hours').hours.getAttribute('aria-label')).toBe('Hours (h)');
    expect(fields('form-hours').minutes.getAttribute('aria-label')).toBe('Hours (min)');
  });

  it('follows the disabled state of the form control', () => {
    const { host, fixture, fields } = setup();
    host.control.disable();
    fixture.detectChanges();
    expect(fields('form-hours').hours.disabled).toBe(true);
    expect(fields('form-hours').minutes.disabled).toBe(true);
  });
});
