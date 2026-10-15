import { TestBed } from '@angular/core/testing';
import { MiniBarChart, barRatios } from './mini-bar-chart';

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
