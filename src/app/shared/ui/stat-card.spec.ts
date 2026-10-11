import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { figureFontSize, parseCountUp, StatCard } from './stat-card';

@Component({
  imports: [StatCard],
  template: `<app-stat-card
    label="Hours"
    [value]="value()"
    [hint]="hint()"
    [trend]="trend()"
    [valueClass]="valueClass()"
  />`,
})
class Host {
  readonly value = signal<string | number>('2.088 h');
  readonly hint = signal<string | null>(null);
  readonly trend = signal<readonly number[] | null>(null);
  readonly valueClass = signal('');
}

describe('StatCard', () => {
  function setup(patch: Partial<{ value: string; hint: string; trend: number[]; valueClass: string }> = {}) {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    const host = fixture.componentInstance;
    if (patch.value !== undefined) host.value.set(patch.value);
    if (patch.hint !== undefined) host.hint.set(patch.hint);
    if (patch.trend !== undefined) host.trend.set(patch.trend);
    if (patch.valueClass !== undefined) host.valueClass.set(patch.valueClass);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('app-stat-card') as HTMLElement;
  }

  it('renders label and the full figure, sized to fit instead of truncated', () => {
    const card = setup();
    expect(card.textContent).toContain('Hours');
    const figure = card.querySelector('span.text-figure') as HTMLElement;
    expect(figure.textContent?.trim()).toBe('2.088 h');
    expect(figure.parentElement?.classList).toContain('whitespace-nowrap');
    expect(figure.parentElement?.classList).not.toContain('truncate');
  });

  it('draws the trend as a strip pinned to the bottom of the card', () => {
    const card = setup({ trend: [1, 3, 2] });
    const strip = card.querySelector('app-sparkline') as HTMLElement;
    expect(strip).not.toBeNull();
    expect(strip.classList).toContain('mt-auto');
    expect(strip.classList).toContain('w-full');
  });

  it('omits the strip without enough trend points', () => {
    expect(setup({ trend: [4] }).querySelector('app-sparkline')).toBeNull();
    TestBed.resetTestingModule();
    expect(setup().querySelector('app-sparkline')).toBeNull();
  });

  it('shows the hint under the figure', () => {
    const card = setup({ hint: '202 h campaign + 38 h online' });
    expect(card.textContent).toContain('202 h campaign + 38 h online');
  });

  it('keeps toned figures on their own color', () => {
    const card = setup({ value: '8.08', valueClass: 'font-mono text-gold' });
    const figure = card.querySelector('span.text-figure-tone') as HTMLElement;
    expect(figure.classList).toContain('text-gold');
  });
});

describe('figureFontSize', () => {
  it('caps at the card maximum and shrinks with the text length', () => {
    expect(figureFontSize('27')).toBe('min(var(--fig-max), calc(100cqi / 1.24))');
    expect(figureFontSize('2.088 h')).toBe('min(var(--fig-max), calc(100cqi / 4.34))');
  });

  it('counts emoji as one glyph and never divides by zero', () => {
    expect(figureFontSize('🏆')).toBe(figureFontSize('x'));
    expect(figureFontSize('')).toBe(figureFontSize('x'));
  });
});

describe('parseCountUp', () => {
  it('keeps decimals, separator and unit', () => {
    const parsed = parseCountUp('112,9 h')!;
    expect(parsed.target).toBe(112.9);
    expect(parsed.format(50)).toBe('50,0 h');
  });

  it('ignores non numeric figures', () => {
    expect(parseCountUp('3 / 10')).toBeNull();
    expect(parseCountUp('—')).toBeNull();
  });
});
