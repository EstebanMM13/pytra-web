import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ICONS } from './icons';
import { PlatformCard } from './platform-card';

@Component({
  imports: [PlatformCard],
  template: `
    <app-platform-card platform="steam" name="Steam" subtitle="Library" [icon]="icon" [disabled]="disabled()">
      <span platformBadge>Linked</span>
      @if (withBody()) {
        <p data-body>Account</p>
      }
    </app-platform-card>
  `,
})
class Host {
  readonly icon = ICONS.monitor;
  readonly disabled = signal(false);
  readonly withBody = signal(true);
}

describe('PlatformCard', () => {
  function setup(patch: Partial<{ disabled: boolean; withBody: boolean }> = {}) {
    const fixture = TestBed.createComponent(Host);
    if (patch.disabled !== undefined) fixture.componentInstance.disabled.set(patch.disabled);
    if (patch.withBody !== undefined) fixture.componentInstance.withBody.set(patch.withBody);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('section') as HTMLElement;
  }

  it('renders the header (labelled title, subtitle, badge) above the projected body', () => {
    const card = setup();
    const title = card.querySelector('h2')!;

    expect(card.dataset['platform']).toBe('steam');
    expect(card.getAttribute('aria-labelledby')).toBe(title.id);
    expect(title.textContent).toContain('Steam');
    expect(card.querySelector('header')?.textContent).toContain('Library');
    expect(card.querySelector('header [platformBadge]')?.textContent).toContain('Linked');
    expect(card.querySelector('header [data-body]')).toBeNull();
    expect(card.querySelector('[data-body]')?.textContent).toContain('Account');
  });

  it('is enabled by default and marks itself aria-disabled when disabled', () => {
    expect(setup().hasAttribute('aria-disabled')).toBe(false);
    TestBed.resetTestingModule();
    const card = setup({ disabled: true });
    expect(card.getAttribute('aria-disabled')).toBe('true');
    expect(card.classList).toContain('opacity-70');
  });

  it('leaves the body wrapper empty when nothing is projected (hidden via :empty)', () => {
    const card = setup({ withBody: false });
    const body = card.querySelector(':scope > div') as HTMLElement;
    expect(body.children.length).toBe(0);
  });
});
