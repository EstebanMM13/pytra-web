import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Combobox, ComboboxOption, comboboxEntries, normalizeSearch } from './combobox';

const GENRES: ComboboxOption[] = [
  { id: 1, label: 'Acción' },
  { id: 2, label: 'Aventura' },
  { id: 3, label: 'Rol' },
  { id: 4, label: 'Action RPG' },
  { id: 5, label: 'Estrategia' },
];

describe('normalizeSearch', () => {
  it('ignores case, accents and extra spaces', () => {
    expect(normalizeSearch('  ACCIÓN   Rpg ')).toBe('accion rpg');
  });
});

describe('comboboxEntries', () => {
  const base = { options: GENRES, selected: [], query: '', multiple: true, creatable: true, noneRow: false, limit: 8 };

  it('filters accent-insensitively, prefix matches first', () => {
    const entries = comboboxEntries({ ...base, query: 'acc' });
    expect(entries.map((e) => (e.kind === 'option' ? e.option.label : e.kind))).toEqual(['Acción', 'create']);
    const rpg = comboboxEntries({ ...base, query: 'a' });
    expect(rpg.slice(0, 3).map((e) => (e.kind === 'option' ? e.option.label : e.kind))).toEqual([
      'Acción',
      'Aventura',
      'Action RPG',
    ]);
  });

  it('hides picked options in multiple mode and caps the list', () => {
    const entries = comboboxEntries({ ...base, selected: [1, 2], limit: 2 });
    expect(entries.map((e) => (e.kind === 'option' ? e.option.id : e.kind))).toEqual([3, 4]);
  });

  it('offers "create" only when nothing matches exactly', () => {
    expect(comboboxEntries({ ...base, query: 'accion' }).some((e) => e.kind === 'create')).toBe(false);
    const created = comboboxEntries({ ...base, query: '  Metroidvania  ' }).at(-1);
    expect(created).toEqual({ kind: 'create', name: 'Metroidvania' });
    expect(comboboxEntries({ ...base, creatable: false, query: 'zzz' })).toEqual([]);
  });

  it('starts single mode with the "none" row and keeps picked options listed', () => {
    const entries = comboboxEntries({ ...base, multiple: false, noneRow: true, selected: [3] });
    expect(entries[0]).toEqual({ kind: 'none' });
    expect(entries.length).toBe(GENRES.length + 1);
  });
});

@Component({
  imports: [Combobox],
  template: `<app-combobox
    multiple
    creatable
    [options]="options"
    [(selected)]="selected"
    (create)="created.set($event)"
  />`,
})
class MultiHost {
  readonly options = GENRES;
  readonly selected = signal<readonly number[]>([3]);
  readonly created = signal<string | null>(null);
}

describe('Combobox (multiple)', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [MultiHost], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(MultiHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    const type = (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const key = (k: string) => {
      const event = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true });
      input.dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };
    const options = () => [...el.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim());
    return { fixture, el, input, type, key, options };
  }

  it('shows picks as chips and picks the first match with Enter', () => {
    const { fixture, el, input, type, key } = setup();
    expect(el.textContent).toContain('Rol');
    input.dispatchEvent(new Event('focus'));
    type('estr');
    key('Enter');
    expect(fixture.componentInstance.selected()).toEqual([3, 5]);
    expect(input.value).toBe('');
  });

  it('moves with the arrows and removes the last chip with Backspace on an empty search', () => {
    const { fixture, input, type, key } = setup();
    input.dispatchEvent(new Event('focus'));
    type('a');
    key('ArrowDown');
    key('Enter');
    expect(fixture.componentInstance.selected()).toEqual([3, 2]);
    key('Backspace');
    key('Backspace');
    expect(fixture.componentInstance.selected()).toEqual([]);
  });

  it('emits create for an unknown name and swallows Escape while open', () => {
    const { fixture, input, type, key, options } = setup();
    input.dispatchEvent(new Event('focus'));
    type('Metroidvania');
    expect(options().at(-1)).toBe('common.combobox.create');
    key('Enter');
    expect(fixture.componentInstance.created()).toBe('Metroidvania');
    type('ro');
    const escape = key('Escape');
    expect(escape.defaultPrevented).toBe(true);
    expect(options()).toEqual([]);
  });
});
