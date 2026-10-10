import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info';

/** Optional button inside a toast (label is an i18n key). */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

const DURATION_MS = 3500;

/** Minimal app-wide feedback: short messages rendered by `ToastHost` at the app root. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly items = signal<Toast[]>([]);
  readonly toasts = this.items.asReadonly();

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  /** Sticky toast with an action button; stays until the user acts or closes it. */
  action(message: string, action: ToastAction): void {
    const id = this.nextId++;
    this.items.update((list) => [...list.slice(-2), { id, message, tone: 'info', action }]);
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }

  private show(message: string, tone: ToastTone): void {
    const id = this.nextId++;
    this.items.update((list) => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => this.dismiss(id), DURATION_MS);
  }
}
