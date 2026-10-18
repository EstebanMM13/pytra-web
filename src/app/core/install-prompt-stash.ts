/**
 * Tiny startup listener for the PWA install prompt, attached from main.ts before bootstrap so the
 * browser's `beforeinstallprompt` (often fired early) is never missed. It keeps the event for the
 * lazily loaded InstallPromptService, which reads it and follows later changes. Kept apart from
 * that service so the service itself stays out of the initial bundle.
 */

/** Chromium's non-standard install prompt event. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

export interface InstallPromptState {
  /** The deferred prompt, until it is used or the app gets installed. */
  deferred: BeforeInstallPromptEvent | null;
  /** `appinstalled` fired during this page's life. */
  installed: boolean;
}

let state: InstallPromptState = { deferred: null, installed: false };
let attached = false;
const listeners = new Set<() => void>();

function update(next: Partial<InstallPromptState>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

/** Attaches the window listeners once (idempotent). Call only outside the native shell. */
export function stashInstallPrompt(): void {
  if (attached || typeof window === 'undefined') {
    return;
  }
  attached = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    update({ deferred: event as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => update({ deferred: null, installed: true }));
}

export function installPromptState(): InstallPromptState {
  return state;
}

/** The prompt can be used once, whatever the outcome. */
export function clearDeferredInstallPrompt(): void {
  update({ deferred: null });
}

/** Calls `listener` on every change; returns the unsubscribe function. */
export function onInstallPromptChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tests only: forget the stashed state (the window listeners stay attached). */
export function resetInstallPromptStash(): void {
  state = { deferred: null, installed: false };
}
