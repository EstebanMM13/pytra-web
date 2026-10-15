import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { MiniBar } from './mini-bar-chart';
import { RecentBarChart, hasHiddenBars, recentBars } from './recent-bar-chart';

function years(from: number, to: number, value = (year: number) => year - from + 1): MiniBar[] {
  return Array.from({ length: to - from + 1 }, (_, i) => {
    const year = from + i;
    return { key: year, value: value(year), label: String(year) };
  });
}

describe('recentBars', () => {
  it('keeps the last five bars, oldest first', () => {
    expect(recentBars(years(2015, 2024)).map((b) => b.key)).toEqual([2020, 2021, 2022, 2023, 2024]);
  });

  it('keeps every bar of a short series', () => {
    expect(recentBars(years(2022, 2024)).map((b) => b.key)).toEqual([2022, 2023, 2024]);
  });

  it('skips years with no data so they do not take a slot', () => {
    const bars = years(2017, 2024, (y) => (y === 2023 || y === 2021 ? 0 : 5));
    bars[4] = { ...bars[4], topLabel: '8.0' }; // 2021: rated, but no hours
    expect(recentBars(bars).map((b) => b.key)).toEqual([2019, 2020, 2021, 2022, 2024]);
  });

  it('honours a custom limit', () => {
    expect(recentBars(years(2020, 2024), 2).map((b) => b.key)).toEqual([2023, 2024]);
  });

  it('reports hidden bars only when the series is longer than what is shown', () => {
    expect(hasHiddenBars(years(2020, 2024))).toBe(false);
    expect(hasHiddenBars(years(2019, 2024))).toBe(true);
    expect(hasHiddenBars([])).toBe(false);
  });
});

@Component({
  imports: [RecentBarChart],
  template: `<app-recent-bar-chart [bars]="bars()" title="Horas por año" />`,
})
class Host {
  readonly bars = signal<MiniBar[]>(years(2020, 2024));
}

describe('RecentBarChart', () => {
  function setup(bars: MiniBar[]) {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.bars.set(bars);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el };
  }
  const barLabels = (root: Element) => [...root.querySelectorAll('[role="listitem"]')].map((b) => b.textContent?.trim());

  it('hides "Ver todos" when every year fits', () => {
    const { el } = setup(years(2020, 2024));
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(5);
    expect(el.querySelector('[data-show-all]')).toBeNull();
  });

  it('shows the last five years and opens the full series in a sheet', () => {
    const { fixture, el } = setup(years(2014, 2024));
    expect(barLabels(el)).toEqual(['2020', '2021', '2022', '2023', '2024']);
    const showAll = el.querySelector<HTMLButtonElement>('[data-show-all]')!;
    expect(showAll.textContent?.trim()).toBe('common.showAll');

    showAll.click();
    fixture.detectChanges();
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Horas por año');
    expect(barLabels(dialog)).toHaveLength(11);
    expect(barLabels(dialog)[0]).toBe('2014');
    // View-only sheet: nothing to save.
    expect([...dialog.querySelectorAll('button')].some((b) => b.textContent?.includes('common.save'))).toBe(false);

    (dialog.querySelector('header button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });
});
