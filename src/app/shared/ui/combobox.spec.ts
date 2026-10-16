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

describe('Combobox (multiple) focus and a11y', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [MultiHost], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(MultiHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    return { fixture, el, input };
  }

  it('points aria-activedescendant at the highlighted option and announces the popup', () => {
    const { fixture, el, input } = setup();
    expect(input.getAttribute('aria-haspopup')).toBe('listbox');
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    fixture.detectChanges();
    const id = input.getAttribute('aria-activedescendant');
    expect(id).toBeTruthy();
    expect(el.querySelector(`#${id}`)?.textContent?.trim()).toBe('Acción');
  });

  it('closes when focus leaves the component (click outside)', () => {
    const { fixture, el, input } = setup();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(el.querySelector('[role="listbox"]')).not.toBeNull();
    el.querySelector('app-combobox')!.dispatchEvent(
      new FocusEvent('focusout', { relatedTarget: document.body, bubbles: true }),
    );
    fixture.detectChanges();
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('ignores Enter while an IME composition is in progress', () => {
    const { fixture, input } = setup();
    input.dispatchEvent(new Event('focus'));
    input.value = 'estr';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toEqual([3]);
  });

  it('keeps the query after a create until the new item is picked', () => {
    const { fixture, input } = setup();
    input.dispatchEvent(new Event('focus'));
    input.value = 'Metroidvania';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    fixture.detectChanges();
    expect(input.value).toBe('Metroidvania');
  });
});

@Component({
  imports: [Combobox],
  template: `<app-combobox ariaLabel="Saga" noneLabel="Sin saga" [options]="options" [(selected)]="selected" />`,
})
class SingleHost {
  readonly options = GENRES;
  readonly selected = signal<readonly number[]>([3]);
}

describe('Combobox (single)', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [SingleHost], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(SingleHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    const options = () => [...el.querySelectorAll('[role="option"]')] as HTMLElement[];
    return { fixture, el, input, options };
  }

  it('shows the pick, labels itself without a visible label and lists the "none" row first', () => {
    const { fixture, input, options } = setup();
    expect(input.value).toBe('Rol');
    expect(input.getAttribute('aria-label')).toBe('Saga');
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(options()[0].textContent?.trim()).toBe('Sin saga');
    // The current pick is highlighted when the list opens.
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[3].id);
  });

  it('clears the pick through the "none" row', () => {
    const { fixture, options, input } = setup();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    options()[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toEqual([]);
  });

  it('closes on Escape without changing the pick and swallows the key', () => {
    const { fixture, el, input } = setup();
    input.dispatchEvent(new Event('focus'));
    input.value = 'ave';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
    input.dispatchEvent(escape);
    fixture.detectChanges();
    expect(escape.defaultPrevented).toBe(true);
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(fixture.componentInstance.selected()).toEqual([3]);
    expect(input.value).toBe('Rol');
  });
});

@Component({
  imports: [Combobox],
  template: `<app-combobox multiple [options]="options" [(selected)]="selected" />`,
})
class ManyHost {
  readonly options: ComboboxOption[] = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, label: `Genre ${i + 1}` }));
  readonly selected = signal<readonly number[]>([]);
}

describe('Combobox long lists', () => {
  it('lists every option in a scrollable listbox (no 8-item cap) and brings it into view', async () => {
    TestBed.configureTestingModule({ imports: [ManyHost], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(ManyHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const scrolled: Element[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    try {
      el.querySelector('input')!.dispatchEvent(new Event('focus'));
      fixture.detectChanges();
      await fixture.whenStable();
      const list = el.querySelector('[role="listbox"]')!;
      expect(list.querySelectorAll('[role="option"]')).toHaveLength(20);
      expect(list.classList).toContain('max-h-64');
      expect(list.classList).toContain('overflow-y-auto');
      expect(scrolled).toContain(list);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('keeps every entry with the default limit', () => {
    const options = Array.from({ length: 30 }, (_, i) => ({ id: i, label: `G${i}` }));
    const entries = comboboxEntries({
      options,
      selected: [],
      query: '',
      multiple: true,
      creatable: false,
      noneRow: false,
      limit: Number.POSITIVE_INFINITY,
    });
    expect(entries).toHaveLength(30);
  });
});
