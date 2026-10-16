import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { LIBRARY_STATUS_FILTERS, LibraryStatusFilter } from './library.logic';
import { LibraryStatusPicker } from './library-status-picker';

@Component({
  imports: [LibraryStatusPicker],
  template: `<app-library-status-picker
    [statuses]="statuses"
    [status]="status()"
    [counts]="counts"
    (statusChange)="status.set($event)"
  />`,
})
class Host {
  readonly statuses = LIBRARY_STATUS_FILTERS;
  readonly status = signal<LibraryStatusFilter>('ALL');
  readonly counts: Record<LibraryStatusFilter, number> = {
    ALL: 12,
    EN_CURSO: 3,
    COMPLETADO: 5,
    ABANDONADO: 1,
    PENDIENTE: 2,
    ONLINE: 1,
  };
}

describe('LibraryStatusPicker', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = el.querySelector<HTMLButtonElement>('[data-status-trigger]')!;
    return { fixture, el, trigger };
  }

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('shows the current status and its count on one compact button', () => {
    const { fixture, trigger } = setup();
    expect(trigger.textContent?.replace(/\s+/g, '')).toBe('library.statusShort:library.status.ALL(12)');
    fixture.componentInstance.status.set('EN_CURSO');
    fixture.detectChanges();
    expect(trigger.textContent?.replace(/\s+/g, '')).toBe('library.statusShort:library.status.EN_CURSO(3)');
  });

  it('lists every status with its count as radios, applies a pick and closes', () => {
    const { fixture, el, trigger } = setup();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    trigger.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');

    const radios = [...el.querySelectorAll<HTMLButtonElement>('[role="radiogroup"] [role="radio"]')];
    expect(radios).toHaveLength(LIBRARY_STATUS_FILTERS.length);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    expect(radios[2].textContent?.replace(/\s+/g, ' ').trim()).toBe('library.status.COMPLETADO5');

    radios[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.status()).toBe('COMPLETADO');
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on Escape without changing the status', () => {
    const { fixture, el, trigger } = setup();
    trigger.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.componentInstance.status()).toBe('ALL');
  });

  it('keeps Tab inside the sheet', () => {
    const { fixture, el, trigger } = setup();
    document.body.appendChild(el);
    trigger.click();
    fixture.detectChanges();
    const radios = [...el.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    radios.at(-1)!.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    radios.at(-1)!.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(radios[0]);
    const back = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true, bubbles: true });
    radios[0].dispatchEvent(back);
    expect(document.activeElement).toBe(radios.at(-1));
    el.remove();
  });

  it('releases the shared scroll lock when destroyed while open', () => {
    const { fixture, trigger } = setup();
    trigger.click();
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');
    fixture.destroy();
    expect(document.body.style.overflow).toBe('');
  });
});
