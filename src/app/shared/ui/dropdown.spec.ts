import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Dropdown, DropdownOption } from './dropdown';

@Component({
  imports: [Dropdown],
  template: `<app-dropdown [options]="options" [(value)]="value" />`,
})
class Host {
  readonly options: DropdownOption[] = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ];
  readonly value = signal('a');
}

describe('Dropdown', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = el.querySelector('button')!;
    return { fixture, el, trigger };
  }

  it('shows the selected label and opens a listbox on click', () => {
    const { fixture, el, trigger } = setup();
    expect(trigger.textContent).toContain('Alpha');
    trigger.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('[role="option"]').length).toBe(2);
  });

  it('picks an option with the keyboard and closes', () => {
    const { fixture, el, trigger } = setup();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('b');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('closes on Escape without changing the value', () => {
    const { fixture, el, trigger } = setup();
    trigger.click();
    fixture.detectChanges();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(fixture.componentInstance.value()).toBe('a');
  });
});
