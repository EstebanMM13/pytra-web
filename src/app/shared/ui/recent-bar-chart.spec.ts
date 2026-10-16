import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { MiniBar } from './mini-bar-chart';
import { CollapseStateService } from '../../core/services/collapse-state.service';
import { RecentBarChart, fitLabels, fullChartOrientation, hasHiddenBars, recentBars } from './recent-bar-chart';

function years(from: number, to: number, value = (year: number) => year - from + 1): MiniBar[] {
  return Array.from({ length: to - from + 1 }, (_, i) => {
    const year = from + i;
    return { key: year, value: value(year), label: `'${String(year).slice(-2)}`, fullLabel: String(year) };
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
  template: `<div class="card-glass" data-card>
    <app-recent-bar-chart [bars]="bars()" [height]="height()" title="Horas por año" />
  </div>`,
})
class Host {
  readonly bars = signal<MiniBar[]>(years(2020, 2024));
  readonly height = signal<number | null>(96);
}

describe('fitLabels', () => {
  it('uses full labels for up to eight bars and compact ones beyond', () => {
    expect(fitLabels(years(2017, 2024)).map((b) => b.label)).toEqual(
      ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'],
    );
    expect(fitLabels(years(2016, 2024)).map((b) => b.label)[0]).toBe("'16");
    expect(fitLabels([{ key: 1, value: 1, label: 'only' }])[0].label).toBe('only');
  });
});

describe('fullChartOrientation', () => {
  it('lays long series out as rows on phones and as columns on wider screens', () => {
    expect(fullChartOrientation(false, 11)).toBe('horizontal');
    expect(fullChartOrientation(true, 11)).toBe('vertical');
    expect(fullChartOrientation(false, 5)).toBe('vertical');
    expect(fullChartOrientation(false, 4, 3)).toBe('horizontal');
  });
});

describe('RecentBarChart', () => {
  function setup(bars: MiniBar[], wide = false) {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideTranslateService(),
        { provide: CollapseStateService, useValue: { atLeast: () => signal(wide).asReadonly() } },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.bars.set(bars);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el };
  }
  const barLabels = (root: Element) =>
    [...root.querySelectorAll('[role="listitem"] > span')].map((b) => b.textContent?.trim());

  it('hides "Ver todos" when every year fits', () => {
    const { el } = setup(years(2020, 2024));
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(5);
    expect(el.querySelector('[data-show-all]')).toBeNull();
  });

  it('shows the last five years and opens the full series in a sheet', () => {
    const { fixture, el } = setup(years(2014, 2024));
    // Full years: five fit.
    expect(barLabels(el)).toEqual(['2020', '2021', '2022', '2023', '2024']);
    const showAll = el.querySelector<HTMLButtonElement>('[data-show-all]')!;
    expect(showAll.textContent?.trim()).toBe('common.showAll');

    showAll.click();
    fixture.detectChanges();
    // Rendered at <body> level, outside the (backdrop-filtered) card that would clip a fixed overlay.
    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(el.querySelector('[data-card] [role="dialog"]')).toBeNull();
    expect(dialog.closest('app-modal-sheet')?.parentElement).toBe(document.body);
    expect(dialog.getAttribute('aria-label')).toBe('Horas por año');
    // Phone: one horizontal row per year, full years.
    expect(dialog.querySelectorAll('[role="listitem"][data-row]')).toHaveLength(11);
    expect(dialog.querySelector('[data-full-plot]')).toBeNull();
    expect(barLabels(dialog)[0]).toBe('2014');
    expect(Number(dialog.querySelector('[data-row] [data-ratio]')?.getAttribute('data-ratio'))).toBeCloseTo(1 / 11);
    // View-only sheet: nothing to save.
    expect([...dialog.querySelectorAll('button')].some((b) => b.textContent?.includes('common.save'))).toBe(false);

    (dialog.querySelector('header button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(document.body.querySelector('app-modal-sheet')).toBeNull();
  });

  it('gives the recent chart a definite height so its bars have one too', () => {
    const { el } = setup(years(2020, 2024));
    const chart = el.querySelector('app-mini-bar-chart') as HTMLElement;
    expect(chart.style.height).toBe('96px');
    // A flex basis would override the fixed height (bars collapsed to zero on phones).
    expect(chart.classList.contains('flex-1')).toBe(false);
    const ratios = [...chart.querySelectorAll('[data-ratio]')].map((b) => Number(b.getAttribute('data-ratio')));
    expect(ratios).toEqual([0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('keeps vertical columns with compact labels in the full view on wide screens', () => {
    const { fixture, el } = setup(years(2014, 2024), true);
    el.querySelector<HTMLButtonElement>('[data-show-all]')!.click();
    fixture.detectChanges();
    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector('[data-row]')).toBeNull();
    expect((dialog.querySelector('[data-full-plot]') as HTMLElement).className).toContain('h-[260px]');
    expect(dialog.querySelectorAll('[role="listitem"]')).toHaveLength(11);
    expect(barLabels(dialog)[0]).toBe("'14");
  });
});
