import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';
import { Segmented, SegmentedOption, segmentIndicatorBox } from './segmented';

describe('segmentIndicatorBox', () => {
  it('returns the option box relative to the control', () => {
    expect(segmentIndicatorBox({ offsetLeft: 40, offsetTop: 3, offsetWidth: 72, offsetHeight: 28 })).toEqual({
      x: 40,
      y: 3,
      width: 72,
      height: 28,
    });
  });

  it('returns null for a missing or unlaid-out option', () => {
    expect(segmentIndicatorBox(null)).toBeNull();
    expect(segmentIndicatorBox(undefined)).toBeNull();
    expect(segmentIndicatorBox({ offsetLeft: 0, offsetTop: 0, offsetWidth: 0, offsetHeight: 0 })).toBeNull();
  });
});

@Component({
  imports: [Segmented],
  template: `<app-segmented [options]="options" [(value)]="value" />`,
})
class Host {
  readonly options: SegmentedOption[] = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];
  readonly value = signal('a');
}

describe('Segmented', () => {
  async function render() {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    return { fixture, el, buttons: Array.from(el.querySelectorAll<HTMLButtonElement>('button[role="radio"]')) };
  }

  it('still selects an option on click and marks it checked', async () => {
    const { fixture, buttons } = await render();
    buttons[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('b');
    expect(buttons[1].getAttribute('aria-checked')).toBe('true');
    expect(buttons[0].getAttribute('aria-checked')).toBe('false');
  });

  it('keeps the active background on the button while the slider cannot be measured', async () => {
    const { el, buttons } = await render();
    expect(buttons[0].className).toContain('bg-brand-tint');
    expect(buttons[1].className).not.toContain('bg-brand-tint');
    const indicator = el.querySelector('[data-segment-indicator]')!;
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
    expect(indicator.className).toContain('invisible');
  });
});
