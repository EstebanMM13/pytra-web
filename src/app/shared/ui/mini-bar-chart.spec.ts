import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MiniBar, MiniBarChart, barRatios } from './mini-bar-chart';

describe('barRatios', () => {
  it('scales bars against the tallest one', () => {
    expect(barRatios([10, 5, 0])).toEqual([1, 0.5, 0]);
  });

  it('keeps tiny non-zero bars visible and handles empty series', () => {
    expect(barRatios([1000, 1])).toEqual([1, 0.02]);
    expect(barRatios([0, 0])).toEqual([0, 0]);
    expect(barRatios([])).toEqual([]);
  });
});

describe('MiniBarChart height', () => {
  function render(height: number | null) {
    const fixture = TestBed.createComponent(MiniBarChart);
    fixture.componentRef.setInput('bars', [{ key: 1, value: 3, label: 'a' }]);
    fixture.componentRef.setInput('height', height);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('uses a fixed height when given one', () => {
    const el = render(96);
    expect(el.style.height).toBe('96px');
    expect(el.style.minHeight).toBe('');
  });

  it('keeps a height floor when filling its parent, in case that height is not definite', () => {
    const el = render(null);
    expect(el.classList.contains('h-full')).toBe(true);
    expect(el.style.minHeight).toBe('140px');
  });
});

describe('MiniBarChart linked, expressive bars', () => {
  const bars: MiniBar[] = [2022, 2023, 2024].map((year, i) => ({
    key: year,
    value: [40, 120, 60][i],
    label: String(year),
    title: `${year}: ${[40, 120, 60][i]} h`,
    hint: `${[40, 120, 60][i]} h`,
    link: `/years/${year}`,
  }));

  function render(options: { expressive?: boolean; items?: MiniBar[] } = {}) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(MiniBarChart);
    fixture.componentRef.setInput('bars', options.items ?? bars);
    fixture.componentRef.setInput('expressive', options.expressive ?? true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const links = () => [...el.querySelectorAll<HTMLAnchorElement>('a[data-bar-link]')];
    const items = () => [...el.querySelectorAll<HTMLElement>('[role="listitem"]')];
    return { fixture, el, links, items };
  }

  function pointer(type: string, pointerType: string): Event {
    const event = new Event(type, { bubbles: false });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    return event;
  }

  it('links every bar to its year page with an accessible name', () => {
    const { links } = render();
    expect(links().map((a) => a.getAttribute('href'))).toEqual(['/years/2022', '/years/2023', '/years/2024']);
    expect(links().map((a) => a.getAttribute('aria-label'))).toEqual(['2022: 40 h', '2023: 120 h', '2024: 60 h']);
  });

  it('renders no links or hints for bars without a link', () => {
    const { el } = render({ items: bars.map(({ link: _link, ...bar }) => bar), expressive: false });
    expect(el.querySelector('a')).toBeNull();
    expect(el.querySelector('[data-hint]')).toBeNull();
  });

  it('lights the focused bar and dims the chart until it blurs', () => {
    const { fixture, el, links, items } = render();
    links()[1].dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(items().map((i) => i.classList.contains('is-active'))).toEqual([false, true, false]);
    expect(el.classList.contains('mbc-has-active')).toBe(true);
    expect(items()[1].querySelector('[data-hint]')?.textContent?.trim()).toBe('120 h');

    links()[1].dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(items().some((i) => i.classList.contains('is-active'))).toBe(false);
    expect(el.classList.contains('mbc-has-active')).toBe(false);
  });

  it('lights a bar on mouse hover and touch press, not on touch hover', () => {
    const { fixture, links, items } = render();
    links()[0].dispatchEvent(pointer('pointerenter', 'touch'));
    fixture.detectChanges();
    expect(items()[0].classList.contains('is-active')).toBe(false);

    links()[0].dispatchEvent(pointer('pointerdown', 'touch'));
    fixture.detectChanges();
    expect(items()[0].classList.contains('is-active')).toBe(true);

    links()[2].dispatchEvent(pointer('pointerenter', 'mouse'));
    links()[0].dispatchEvent(pointer('pointerleave', 'touch'));
    fixture.detectChanges();
    // The late leave of the first bar does not clear the second one's highlight.
    expect(items().map((i) => i.classList.contains('is-active'))).toEqual([false, false, true]);
  });

  it('draws every bar with the same gradient, with no accent or top-bar marks', () => {
    const { items } = render();
    expect(items().every((i) => i.querySelector('[data-ratio]')?.className.includes('mbc-bar'))).toBe(true);
    expect(items().some((i) => i.classList.contains('is-accent') || i.classList.contains('is-top'))).toBe(false);
    expect(items().some((i) => i.querySelector(':scope > span')?.className.includes('text-gold'))).toBe(false);
  });

  it('keeps the hint inside the plot: capped under its top and hugging the outer edge at the ends', () => {
    const { items } = render();
    const hints = items().map((i) => i.querySelector<HTMLElement>('[data-hint]')!);
    // Above the bar top, but never higher than its own height under the plot's top edge.
    expect(hints[1].style.bottom).toBe('min(1 * (100% - 0px) + 4px, 100% - 17px)');
    expect(hints.map((h) => h.classList.contains('mbc-hint-start'))).toEqual([true, false, false]);
    expect(hints.map((h) => h.classList.contains('mbc-hint-end'))).toEqual([false, false, true]);
  });

  it('keeps the flat look without expressive', () => {
    const { items } = render({ expressive: false });
    expect(items().some((i) => i.classList.contains('mbc-col'))).toBe(false);
    expect(items()[1].querySelector('[data-ratio]')?.className).toContain('bg-brand-light');
  });
});
