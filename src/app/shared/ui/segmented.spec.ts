import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

  describe('once laid out', () => {
    const props = ['offsetLeft', 'offsetTop', 'offsetWidth', 'offsetHeight'] as const;
    const saved = props.map((p) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, p));

    beforeEach(() => {
      // jsdom has no layout: give every option a box, each one 60px to the right of the previous.
      const index = (el: HTMLElement) => (el.parentElement ? [...el.parentElement.querySelectorAll('button')].indexOf(el as HTMLButtonElement) : 0);
      const box: Record<(typeof props)[number], (el: HTMLElement) => number> = {
        offsetLeft: (el) => 3 + index(el) * 60,
        offsetTop: () => 3,
        offsetWidth: () => 60,
        offsetHeight: () => 28,
      };
      for (const p of props) {
        Object.defineProperty(HTMLElement.prototype, p, { configurable: true, get(this: HTMLElement) { return box[p](this); } });
      }
    });

    afterEach(() => {
      props.forEach((p, i) => Object.defineProperty(HTMLElement.prototype, p, saved[i]!));
    });

    it('moves the highlight under the picked option and drops the button background', async () => {
      const { fixture, el, buttons } = await render();
      const indicator = el.querySelector<HTMLElement>('[data-segment-indicator]')!;
      expect(indicator.className).not.toContain('invisible');
      expect(indicator.style.transform).toBe('translate(3px, 3px)');
      expect(indicator.style.width).toBe('60px');
      expect(indicator.style.height).toBe('28px');
      expect(buttons[0].className).not.toContain('bg-brand-tint');
      expect(buttons[0].className).toContain('text-brand-lighter');

      buttons[1].click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(indicator.style.transform).toBe('translate(63px, 3px)');
      expect(buttons[1].className).not.toContain('bg-brand-tint');
    });
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
