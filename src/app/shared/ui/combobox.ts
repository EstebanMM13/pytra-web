import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { ICONS } from './icons';

export interface ComboboxOption {
  id: number;
  /** Display text; also what the search matches against. */
  label: string;
}

/** One row of the open list: an option, the "none" row (single mode) or the "create" row. */
export type ComboboxEntry =
  | { kind: 'option'; option: ComboboxOption }
  | { kind: 'none' }
  | { kind: 'create'; name: string };

/** Lower case without accents or extra spaces, so "rol" finds "Rol" and "accion" finds "Acción". */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rows to show for `query`: options not yet picked whose label contains it (prefix matches first,
 * then the given order), capped at `limit`; then "create" when nothing matches the query exactly.
 * In single mode an empty query starts with the "none" row.
 */
export function comboboxEntries(params: {
  options: readonly ComboboxOption[];
  selected: readonly number[];
  query: string;
  multiple: boolean;
  creatable: boolean;
  noneRow: boolean;
  limit: number;
}): ComboboxEntry[] {
  const { options, selected, query, multiple, creatable, noneRow, limit } = params;
  const q = normalizeSearch(query);
  const picked = new Set(selected);
  const pool = multiple ? options.filter((o) => !picked.has(o.id)) : options;
  const scored = pool
    .map((option, index) => ({ option, index, label: normalizeSearch(option.label) }))
    .filter((o) => !q || o.label.includes(q))
    .sort((a, b) => (q ? Number(!a.label.startsWith(q)) - Number(!b.label.startsWith(q)) : 0) || a.index - b.index);
  const entries: ComboboxEntry[] = [];
  if (noneRow && !multiple && !q) {
    entries.push({ kind: 'none' });
  }
  for (const { option } of scored.slice(0, limit)) {
    entries.push({ kind: 'option', option });
  }
  if (creatable && q && !options.some((o) => normalizeSearch(o.label) === q)) {
    entries.push({ kind: 'create', name: query.trim().replace(/\s+/g, ' ') });
  }
  return entries;
}

let nextId = 0;

/**
 * Searchable select with a typeahead list, for single (`multiple` off) or multiple picks.
 * Multiple: picks show as removable chips before the input; Backspace on an empty search removes
 * the last one. Single: the field shows the pick's label and an optional "none" row clears it.
 * With `creatable`, a query matching no option offers a "create" row that emits `create`
 * (the parent creates the item and adds its id to `selected`).
 * Keyboard: arrows move, Enter picks, Escape closes the list (without closing a host dialog).
 * The list renders in the flow under the field, so it never gets clipped by a scrolling dialog.
 */
@Component({
  selector: 'app-combobox',
  imports: [TranslatePipe, LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    <div
      class="flex min-h-[50px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl border bg-surface py-1.5 pr-2 pl-2 transition-colors md:min-h-[46px] md:rounded-[10px] md:bg-bg"
      [class]="
        open()
          ? 'border-brand-light shadow-[0_0_0_3px_color-mix(in_srgb,var(--pt-brand)_20%,transparent)]'
          : 'border-border'
      "
      (click)="focusInput()"
    >
      @if (multiple()) {
        @for (option of selectedOptions(); track option.id) {
          <span
            class="inline-flex max-w-full items-center gap-1 rounded-full border border-brand/25 bg-brand-tint py-1 pr-1 pl-2.5 text-[13px] text-brand-lighter"
          >
            <span class="truncate">{{ option.label }}</span>
            <button
              type="button"
              (click)="$event.stopPropagation(); remove(option.id)"
              class="grid size-5 shrink-0 place-items-center rounded-full text-brand-light hover:bg-hover hover:text-text"
              [attr.aria-label]="removeLabel() | translate: { name: option.label }"
            >
              <svg [lucideIcon]="icons.x" [size]="12"></svg>
            </button>
          </span>
        }
      } @else {
        <svg [lucideIcon]="icons.search" [size]="16" class="ml-1.5 shrink-0 text-faint" aria-hidden="true"></svg>
      }
      <input
        #search
        type="text"
        role="combobox"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-autocomplete="list"
        [id]="inputId()"
        [attr.aria-labelledby]="labelledBy() || null"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="open() && activeIndex() >= 0 ? listId + '-' + activeIndex() : null"
        [value]="inputText()"
        [placeholder]="inputPlaceholder() | translate"
        (input)="onInput($event)"
        (focus)="openList()"
        (click)="openList()"
        (keydown)="onKeydown($event)"
        class="h-9 min-w-24 flex-1 border-0 bg-transparent px-1.5 text-[16px] text-text shadow-none outline-none focus:border-0 focus:shadow-none md:text-[15px]"
        [class]="!multiple() && selectedOptions().length ? 'placeholder:text-text-2' : ''"
      />
      @if (!multiple() && selectedOptions().length) {
        <button
          type="button"
          (click)="$event.stopPropagation(); clear()"
          class="grid size-7 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"
          [attr.aria-label]="clearLabel() | translate"
        >
          <svg [lucideIcon]="icons.x" [size]="15"></svg>
        </button>
      }
    </div>

    @if (open()) {
      <ul
        role="listbox"
        [id]="listId"
        [attr.aria-labelledby]="labelledBy() || null"
        [attr.aria-multiselectable]="multiple() || null"
        class="scroll-thin mt-1.5 max-h-60 overflow-y-auto rounded-[10px] border border-border bg-surface p-1 shadow-[0_12px_32px_#0006]"
      >
        @for (entry of entries(); track $index; let i = $index) {
          <li
            role="option"
            [id]="listId + '-' + i"
            [attr.aria-selected]="isSelected(entry)"
            class="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm md:text-[13px]"
            [class]="i === activeIndex() ? 'bg-hover text-text' : isSelected(entry) ? 'text-brand-lighter' : 'text-text-2'"
            (mouseenter)="activeIndex.set(i)"
            (mousedown)="$event.preventDefault()"
            (click)="pick(entry)"
          >
            @switch (entry.kind) {
              @case ('option') {
                <span class="min-w-0 flex-1 truncate">{{ entry.option.label }}</span>
                @if (isSelected(entry)) {
                  <svg [lucideIcon]="icons.check" [size]="14" class="shrink-0 text-brand-light"></svg>
                }
              }
              @case ('none') {
                <span class="min-w-0 flex-1 truncate text-muted italic">{{ noneLabel() | translate }}</span>
                @if (isSelected(entry)) {
                  <svg [lucideIcon]="icons.check" [size]="14" class="shrink-0 text-brand-light"></svg>
                }
              }
              @case ('create') {
                <svg [lucideIcon]="icons.plus" [size]="14" class="shrink-0 text-brand-light"></svg>
                <span class="min-w-0 flex-1 truncate">{{ createLabel() | translate: { name: entry.name } }}</span>
              }
            }
          </li>
        } @empty {
          <li class="px-3 py-2 text-[13px] text-muted">{{ emptyLabel() | translate }}</li>
        }
      </ul>
    }
  `,
})
export class Combobox {
  protected readonly icons = ICONS;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');

  readonly options = input.required<readonly ComboboxOption[]>();
  /** Picked ids: any number with `multiple`, else zero or one. */
  readonly selected = model<readonly number[]>([]);
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly creatable = input(false, { transform: booleanAttribute });
  /** Max option rows listed at once (the search narrows the rest). */
  readonly limit = input(8, { transform: numberAttribute });
  /** id of the visible label element. */
  readonly labelledBy = input('');
  /** id for the input, so a `<label for>` can point at it. */
  readonly inputId = input(`pt-combobox-${nextId++}`);
  // Translation keys (plain text also renders as-is).
  readonly placeholder = input('');
  /** Single mode: row that clears the pick (e.g. "Sin saga"); empty hides it. */
  readonly noneLabel = input('');
  readonly createLabel = input('common.combobox.create');
  readonly emptyLabel = input('common.combobox.empty');
  readonly removeLabel = input('common.combobox.remove');
  readonly clearLabel = input('common.combobox.clear');
  /** Emits the trimmed query when the user picks the "create" row. */
  readonly create = output<string>();

  protected readonly listId = `pt-combobox-list-${nextId++}`;
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(-1);

  protected readonly selectedOptions = computed(() => {
    const byId = new Map(this.options().map((o) => [o.id, o]));
    return this.selected()
      .map((id) => byId.get(id))
      .filter((o): o is ComboboxOption => !!o);
  });

  protected readonly entries = computed(() =>
    comboboxEntries({
      options: this.options(),
      selected: this.selected(),
      query: this.query(),
      multiple: this.multiple(),
      creatable: this.creatable(),
      noneRow: !!this.noneLabel(),
      limit: this.multiple() ? this.limit() : Number.MAX_SAFE_INTEGER,
    }),
  );

  /** Single mode shows the pick while closed and the search while open. */
  protected readonly inputText = computed(() =>
    this.multiple() || this.open() ? this.query() : (this.selectedOptions()[0]?.label ?? ''),
  );

  protected readonly inputPlaceholder = computed(() => {
    const picked = this.selectedOptions()[0]?.label;
    return !this.multiple() && picked ? picked : this.placeholder();
  });

  protected isSelected(entry: ComboboxEntry): boolean {
    if (entry.kind === 'option') return this.selected().includes(entry.option.id);
    return entry.kind === 'none' && this.selected().length === 0;
  }

  protected focusInput(): void {
    this.searchInput().nativeElement.focus();
  }

  protected openList(): void {
    if (this.open()) return;
    this.open.set(true);
    this.activeIndex.set(this.firstActiveIndex());
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.open.set(true);
    this.activeIndex.set(this.firstActiveIndex());
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.entries().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.open()) {
          this.openList();
          return;
        }
        if (!count) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex.set((this.activeIndex() + step + count) % count);
        this.scrollActiveIntoView();
        return;
      }
      case 'Enter': {
        // Never submits the surrounding form from the search box.
        event.preventDefault();
        const entry = this.entries()[this.activeIndex()];
        if (this.open() && entry) this.pick(entry);
        return;
      }
      case 'Escape':
        if (this.open()) {
          // Handled here: a host dialog listening for Escape must stay open.
          event.preventDefault();
          event.stopPropagation();
          this.close();
        }
        return;
      case 'Backspace':
        if (this.multiple() && !this.query() && this.selected().length) {
          event.preventDefault();
          this.selected.set(this.selected().slice(0, -1));
        }
        return;
      case 'Tab':
        this.close();
        return;
    }
  }

  protected pick(entry: ComboboxEntry): void {
    switch (entry.kind) {
      case 'option': {
        const id = entry.option.id;
        if (this.multiple()) {
          this.selected.set(this.selected().includes(id) ? this.selected().filter((s) => s !== id) : [...this.selected(), id]);
          this.query.set('');
          this.activeIndex.set(this.firstActiveIndex());
        } else {
          this.selected.set([id]);
          this.close();
        }
        break;
      }
      case 'none':
        this.selected.set([]);
        this.close();
        break;
      case 'create':
        this.create.emit(entry.name);
        this.query.set('');
        if (this.multiple()) this.activeIndex.set(this.firstActiveIndex());
        else this.close();
        break;
    }
  }

  protected remove(id: number): void {
    this.selected.set(this.selected().filter((s) => s !== id));
    this.focusInput();
  }

  protected clear(): void {
    this.selected.set([]);
    this.query.set('');
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.host.contains(next)) {
      this.close();
    }
  }

  private close(): void {
    this.open.set(false);
    this.query.set('');
    this.activeIndex.set(-1);
  }

  /** Highlights the first real match as you type, so Enter picks it. */
  private firstActiveIndex(): number {
    const entries = this.entries();
    if (!this.query()) {
      return this.multiple() ? -1 : entries.findIndex((e) => this.isSelected(e));
    }
    return entries.length ? 0 : -1;
  }

  private scrollActiveIntoView(): void {
    queueMicrotask(() =>
      this.host.querySelector(`#${this.listId}-${this.activeIndex()}`)?.scrollIntoView({ block: 'nearest' }),
    );
  }
}
