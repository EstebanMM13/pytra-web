import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { SectionHeader } from './section-header';

@Component({
  imports: [SectionHeader],
  template: `
    <section>
      <app-section-header collapseKey="test.card" label="Runs" />
      <p>Body</p>
    </section>
  `,
})
class Host {}

const STORAGE_KEY = 'pytra.collapsed.test.card';

describe('SectionHeader', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      card: el.querySelector('section') as HTMLElement,
      button: el.querySelector('button') as HTMLButtonElement,
      chevron: () => el.querySelector('[data-chevron]') as HTMLElement,
    };
  }

  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('starts expanded with the chevron pointing down', () => {
    const { card, button, chevron } = setup();
    expect(card.getAttribute('data-collapsed')).toBe('false');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(chevron().classList).not.toContain('-rotate-90');
  });

  it('shows a persisted collapse on init: card collapsed and chevron rotated', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    const { card, button, chevron } = setup();
    expect(card.getAttribute('data-collapsed')).toBe('true');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(chevron().classList).toContain('-rotate-90');
  });

  it('rotates the chevron back when a persisted collapse is expanded', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    const { fixture, button, chevron } = setup();
    button.click();
    fixture.detectChanges();
    expect(chevron().classList).not.toContain('-rotate-90');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
