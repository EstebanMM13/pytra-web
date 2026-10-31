import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { RunRow } from './run-row';

@Component({
  imports: [RunRow],
  template: `<app-run-row
    title="Run 1"
    meta="PS5"
    [hours]="12"
    [rating]="8"
    [best]="best()"
    [platinum]="platinum()"
    [fullCompletion]="fullCompletion()"
    [postgame]="postgame()"
  >
    <span runRowBelow class="mt-1.5 sm:hidden" data-below-status>Done</span>
    <span class="hidden sm:block" data-side-status>Done</span>
  </app-run-row>`,
})
class Host {
  readonly best = signal(false);
  readonly platinum = signal(false);
  readonly fullCompletion = signal(false);
  readonly postgame = signal(false);
}

describe('RunRow', () => {
  function setup(flags: Partial<{ best: boolean; platinum: boolean; fullCompletion: boolean; postgame: boolean }> = {}) {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(Host);
    const host = fixture.componentInstance;
    host.best.set(flags.best ?? false);
    host.platinum.set(flags.platinum ?? false);
    host.fullCompletion.set(flags.fullCompletion ?? false);
    host.postgame.set(flags.postgame ?? false);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const titleLine = el.querySelector('p')!;
    const statusLine = el.querySelector('[data-status-line]')!;
    return { el, titleLine, statusLine };
  }

  it('keeps the title line free of the platinum and 100% badges', () => {
    const { titleLine } = setup({ platinum: true, fullCompletion: true });
    expect(titleLine.querySelector('[data-platinum]')).toBeNull();
    expect(titleLine.querySelector('[data-full-completion]')).toBeNull();
  });

  it('shows the badges as labelled icon pills next to the status, on phones and from sm up', () => {
    const { el, statusLine } = setup({ platinum: true, fullCompletion: true });

    // Phones: on the status line, after the projected status pill
    const below = statusLine.querySelector('[data-below-status]')!;
    const phonePlatinum = statusLine.querySelector('[data-platinum]')!;
    const phoneFull = statusLine.querySelector('[data-full-completion]')!;
    expect(phonePlatinum.closest('.sm\\:hidden')).not.toBeNull();
    expect(below.compareDocumentPosition(phonePlatinum) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // From sm up: right before the projected side status
    const side = el.querySelector('[data-side-status]')!;
    const desktopPlatinum = [...el.querySelectorAll('[data-platinum]')].find((b) => !statusLine.contains(b))!;
    expect(desktopPlatinum.closest('.sm\\:flex')).not.toBeNull();
    expect(desktopPlatinum.compareDocumentPosition(side) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    for (const badge of el.querySelectorAll('[data-platinum]')) {
      expect(badge.getAttribute('role')).toBe('img');
      expect(badge.getAttribute('aria-label')).toBe('game.stats.platinum');
      expect(badge.getAttribute('title')).toBe('game.stats.platinum');
      expect(badge.querySelector('svg')).not.toBeNull();
    }
    expect(phoneFull.getAttribute('aria-label')).toBe('run.fullCompletionAria');
    expect(phoneFull.getAttribute('title')).toBe('run.fullCompletionAria');
    expect(el.querySelectorAll('[data-full-completion]').length).toBe(2);
  });

  it('shows the postgame pill next to the status only when the run is in its postgame', () => {
    expect(setup().el.querySelector('[data-postgame]')).toBeNull();
    TestBed.resetTestingModule();

    const { el, statusLine, titleLine } = setup({ postgame: true });
    expect(titleLine.querySelector('[data-postgame]')).toBeNull();
    expect(statusLine.querySelector('[data-postgame]')!.textContent).toContain('run.postgame');
    expect(el.querySelectorAll('[data-postgame]').length).toBe(2);
    expect(el.querySelector('[data-postgame]')!.getAttribute('title')).toBe('run.postgameAria');
  });

  it('renders each badge only when its flag is set', () => {
    const platinumOnly = setup({ platinum: true }).el;
    expect(platinumOnly.querySelector('[data-platinum]')).not.toBeNull();
    expect(platinumOnly.querySelector('[data-full-completion]')).toBeNull();
    TestBed.resetTestingModule();

    const none = setup().el;
    expect(none.querySelector('[data-platinum]')).toBeNull();
    expect(none.querySelector('[data-full-completion]')).toBeNull();
    expect(none.querySelector('[data-best]')).toBeNull();
  });

  it('moves the best pill to the status line on phones and keeps it by the title from sm up', () => {
    const { titleLine, statusLine } = setup({ best: true });
    const byTitle = titleLine.querySelector('[data-best]')!;
    expect(byTitle.classList).toContain('hidden');
    expect(byTitle.classList).toContain('sm:inline-flex');
    expect(statusLine.querySelector('[data-best]')!.closest('.sm\\:hidden')).not.toBeNull();
  });
});
