import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { StatsBar, StatsBarList } from './stats-bar-list';

const rows = (prefix: string, count: number): StatsBar[] =>
  Array.from({ length: count }, (_, i) => ({ key: i, label: `${prefix} ${i}`, share: 1, figure: '1' }));

@Component({
  imports: [StatsBarList],
  template: `<app-stats-bar-list [bars]="bars()" [limit]="6" />`,
})
class Host {
  readonly bars = signal(rows('hours', 10));
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
});
