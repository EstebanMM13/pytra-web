import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { YearSelector } from './year-selector';

@Component({
  imports: [YearSelector],
  template: `<app-year-selector [years]="years()" [year]="year()" (yearChange)="year.set($event)" />`,
})
class Host {
  readonly years = signal<readonly number[]>([2026, 2025, 2023]);
  readonly year = signal<number | null>(2026);
}

describe('YearSelector', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = (sel: string) => el.querySelector<HTMLButtonElement>(sel)!;
    return { fixture, el, older: q('[data-year-older]'), newer: q('[data-year-newer]'), trigger: q('[data-year-trigger]') };
  }

  afterEach(() => {
    document.body.style.overflow = '';
    TestBed.resetTestingModule();
  });

  it('steps to older / newer years and disables the arrows at the ends', () => {
    const { fixture, older, newer, trigger } = setup();
    expect(trigger.textContent?.trim()).toBe('2026');
    expect(newer.disabled).toBe(true);
    expect(older.disabled).toBe(false);

    older.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.year()).toBe(2025);
    older.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.year()).toBe(2023);
    expect(older.disabled).toBe(true);
    expect(newer.disabled).toBe(false);

    newer.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.year()).toBe(2025);
  });

  it('opens a bottom sheet with every year, applies a pick and closes', () => {
    const { fixture, el, trigger } = setup();
    trigger.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');

    const radios = [...el.querySelectorAll<HTMLButtonElement>('[role="radiogroup"] [role="radio"]')];
    expect(radios.map((r) => r.textContent?.trim())).toEqual(['2026', '2025', '2023']);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');

    radios[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.year()).toBe(2023);
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on Escape without changing the year', () => {
    const { fixture, el, trigger } = setup();
    trigger.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.componentInstance.year()).toBe(2026);
  });

  it('has nothing to pick with a single year', () => {
    const { fixture, older, newer, trigger } = setup();
    fixture.componentInstance.years.set([2026]);
    fixture.detectChanges();
    expect(older.disabled).toBe(true);
    expect(newer.disabled).toBe(true);
    expect(trigger.disabled).toBe(true);
  });
});
