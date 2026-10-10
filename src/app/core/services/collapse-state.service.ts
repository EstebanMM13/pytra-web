import { Injectable, Signal, WritableSignal, signal } from '@angular/core';

const KEY_PREFIX = 'pytra.collapsed.';

/**
 * Per-card collapsed state, persisted per device in localStorage.
 * Keys are stable "screen.card" ids (e.g. `dashboard.bySaga`); default is expanded.
 */
@Injectable({ providedIn: 'root' })
export class CollapseStateService {
  private readonly states = new Map<string, WritableSignal<boolean>>();

  collapsed(key: string): Signal<boolean> {
    return this.state(key).asReadonly();
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
