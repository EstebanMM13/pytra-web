import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { StatsBar, StatsBarList } from './stats-bar-list';

const rows = (prefix: string, count: number): StatsBar[] =>
  Array.from({ length: count }, (_, i) => ({ key: i, label: `${prefix} ${i}`, share: 1, figure: '1' }));

@Component({
  imports: [StatsBarList],
  template: `<app-stats-bar-list [bars]="bars()" [limit]="6" [ranked]="ranked()" />`,
})
class Host {
  readonly bars = signal(rows('hours', 10));
  readonly ranked = signal(false);
}

describe('StatsBarList', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideTranslateService()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const shown = () => el.querySelectorAll('[data-bar-row]').length;
    const toggle = () => el.querySelector<HTMLButtonElement>('[data-bar-toggle]');
    return { fixture, shown, toggle };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the first rows and expands the rest in place', () => {
    const { fixture, shown, toggle } = setup();
    expect(shown()).toBe(6);
    toggle()!.click();
    fixture.detectChanges();
    expect(shown()).toBe(10);
  });

  it('collapses again when other rows come in (another ranking), not on a refresh of the same rows', () => {
    const { fixture, shown, toggle } = setup();
    toggle()!.click();
    fixture.detectChanges();
    fixture.componentInstance.bars.set(rows('hours', 10));
    fixture.detectChanges();
    expect(shown()).toBe(10);

    fixture.componentInstance.bars.set(rows('rating', 10));
    fixture.detectChanges();
    expect(shown()).toBe(6);
  });

  it('shows a list one row over the limit whole, without a toggle', () => {
    const { fixture, shown, toggle } = setup();
    fixture.componentInstance.bars.set(rows('hours', 7));
    fixture.detectChanges();
    expect(shown()).toBe(7);
    expect(toggle()).toBeNull();
  });

  it('numbers ranked rows, the first in a gold chip', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-rank-first]')).toBeNull();
    fixture.componentInstance.ranked.set(true);
    fixture.detectChanges();
    expect(el.querySelector('[data-rank-first]')!.textContent!.trim()).toBe('1');
    expect([...el.querySelectorAll('[data-rank]')].map((r) => r.textContent!.trim())).toEqual(['2', '3', '4', '5', '6']);
  });

  it('reverses a long list with the order button, ranks kept', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.ranked.set(true);
    fixture.detectChanges();
    const labels = () =>
      [...el.querySelectorAll('[data-bar-row]')].map(
        (r) => `${r.querySelector('[data-rank], [data-rank-first]')!.textContent!.trim()} ${r.querySelector('[title]')!.getAttribute('title')}`,
      );
    const order = el.querySelector<HTMLButtonElement>('[data-bar-order]')!;
    expect(order.getAttribute('aria-pressed')).toBe('false');

    order.click();
    fixture.detectChanges();
    expect(order.getAttribute('aria-pressed')).toBe('true');
    expect(labels()).toEqual(['10 hours 9', '9 hours 8', '8 hours 7', '7 hours 6', '6 hours 5', '5 hours 4']);
    expect(el.querySelector('[data-rank-first]')).toBeNull();

    el.querySelector<HTMLButtonElement>('[data-bar-toggle]')!.click();
    fixture.detectChanges();
    expect(labels().at(-1)).toBe('1 hours 0');
    expect(el.querySelector('[data-rank-first]')!.textContent!.trim()).toBe('1');

    order.click();
    fixture.detectChanges();
    expect(labels()[0]).toBe('1 hours 0');
  });

  it('shows no order button on a short list', () => {
    const { fixture } = setup();
    fixture.componentInstance.bars.set(rows('hours', 7));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-bar-order]')).toBeNull();
  });
});
