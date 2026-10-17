import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Sparkline, sparklinePoints } from './sparkline';

describe('sparklinePoints', () => {
  it('needs at least two values', () => {
    expect(sparklinePoints([])).toEqual([]);
    expect(sparklinePoints([5])).toEqual([]);
  });

  it('spans the box with min at the bottom and max at the top', () => {
    expect(sparklinePoints([0, 10], 60, 18, 0)).toEqual([
      [0, 18],
      [60, 0],
    ]);
  });

  it('centers a flat series', () => {
    expect(sparklinePoints([3, 3, 3], 60, 18, 0).map(([, y]) => y)).toEqual([9, 9, 9]);
  });
});

@Component({
  imports: [Sparkline],
  template: `<app-sparkline [values]="values()" />`,
})
class Host {
  readonly values = signal<number[]>([1, 4, 2, 6]);
}

describe('Sparkline', () => {
  it('draws the line in over a unit path length, with the area fading in behind it', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const line = el.querySelector('path.spark-line')!;
    expect(line.getAttribute('pathLength')).toBe('1');
    expect(line.getAttribute('d')).toMatch(/^M/);
    expect(el.querySelector('path.spark-area')).not.toBeNull();
  });

  it('renders nothing with fewer than two values', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.values.set([3]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('svg')).toBeNull();
  });
});
