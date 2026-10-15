import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ModalSheet } from './modal-sheet';

@Component({
  imports: [ModalSheet],
  template: `
    <div class="card-glass" data-card>
      @if (first()) {
        <app-modal-sheet title="First" viewOnly (closed)="closed.push('first'); first.set(false)">
          <button type="button">a</button>
        </app-modal-sheet>
      }
      @if (second()) {
        <app-modal-sheet title="Second" viewOnly (closed)="closed.push('second'); second.set(false)">
          <button type="button">b</button>
        </app-modal-sheet>
      }
    </div>
  `,
})
class Host {
  readonly first = signal(false);
  readonly second = signal(false);
  readonly closed: string[] = [];
}

describe('ModalSheet', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const open = (which: 'first' | 'second') => {
      host[which].set(true);
      fixture.detectChanges();
    };
    const close = (which: 'first' | 'second') => {
      host[which].set(false);
      fixture.detectChanges();
    };
    const sheets = () => [...document.body.querySelectorAll('app-modal-sheet')];
    return { fixture, host, open, close, sheets };
  }

  beforeEach(() => {
    document.body.style.overflow = 'auto';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('moves to <body> when opened, outside its card, and leaves on destroy', () => {
    const { fixture, open, sheets } = setup();
    open('first');
    expect(sheets()).toHaveLength(1);
    expect(sheets()[0].parentElement).toBe(document.body);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-card] app-modal-sheet')).toBeNull();

    // Destroying the whole page while the sheet is open removes it too.
    fixture.destroy();
    expect(sheets()).toHaveLength(0);
    expect(document.body.style.overflow).toBe('auto');
  });

  for (const order of [
    ['first', 'second'],
    ['second', 'first'],
  ] as const) {
    it(`locks page scroll until the last sheet closes (closing ${order.join(' then ')})`, () => {
      const { open, close } = setup();
      open('first');
      open('second');
      expect(document.body.style.overflow).toBe('hidden');
      close(order[0]);
      expect(document.body.style.overflow).toBe('hidden');
      close(order[1]);
      expect(document.body.style.overflow).toBe('auto');
    });
  }

  it('closes only the topmost sheet on Escape', () => {
    const { fixture, host, open, sheets } = setup();
    open('first');
    open('second');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    fixture.detectChanges();
    expect(host.closed).toEqual(['second']);
    expect(sheets().map((s) => s.querySelector('[role="dialog"]')?.getAttribute('aria-label'))).toEqual(['First']);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    fixture.detectChanges();
    expect(host.closed).toEqual(['second', 'first']);
    expect(sheets()).toHaveLength(0);
  });
});
