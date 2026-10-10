import { Injectable, Signal, WritableSignal, signal } from '@angular/core';

const KEY_PREFIX = 'pytra.collapsed.';
const ROW_PREFIX = 'row.';

/** Tailwind breakpoints (rem) from which a grid row lays its cards side by side. */
export type CollapseBreakpoint = 'md' | 'lg';
const BREAKPOINT_QUERIES: Record<CollapseBreakpoint, string> = {
  md: '(min-width: 48rem)',
  lg: '(min-width: 64rem)',
};

/**
 * Collapsed state for section cards, persisted per device in localStorage.
 *
 * Two independent namespaces:
 * - card keys (`dashboard.bySaga`): used when a card stands alone (mobile / single column);
 * - row keys (`row.dashboard.lists`): shared by every card of a desktop grid row, so the
 *   whole row collapses together and the row height actually shrinks.
 * Default is expanded.
 */
@Injectable({ providedIn: 'root' })
export class CollapseStateService {
  private readonly states = new Map<string, WritableSignal<boolean>>();
  private readonly media = new Map<CollapseBreakpoint, Signal<boolean>>();

  collapsed(key: string): Signal<boolean> {
    return this.state(key).asReadonly();
  }

  rowCollapsed(group: string): Signal<boolean> {
    return this.collapsed(ROW_PREFIX + group);
  }

  toggle(key: string): void {
    const state = this.state(key);
    state.set(!state());
    try {
      if (state()) localStorage.setItem(KEY_PREFIX + key, '1');
      else localStorage.removeItem(KEY_PREFIX + key);
    } catch {
      // Storage unavailable (private mode, quota): keep the in-memory state only.
    }
  }

  toggleRow(group: string): void {
    this.toggle(ROW_PREFIX + group);
  }

  /** Whether the viewport is at or above `bp` (live; false where matchMedia is missing). */
  atLeast(bp: CollapseBreakpoint): Signal<boolean> {
    let matches = this.media.get(bp);
    if (!matches) {
      const query = typeof matchMedia === 'function' ? matchMedia(BREAKPOINT_QUERIES[bp]) : null;
      const state = signal(query?.matches ?? false);
      query?.addEventListener('change', (e) => state.set(e.matches));
      matches = state.asReadonly();
      this.media.set(bp, matches);
    }
    return matches;
  }

  private state(key: string): WritableSignal<boolean> {
    let state = this.states.get(key);
    if (!state) {
      state = signal(readCollapsed(key));
      this.states.set(key, state);
    }
    return state;
  }
}

function readCollapsed(key: string): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + key) === '1';
  } catch {
    return false;
  }
}
