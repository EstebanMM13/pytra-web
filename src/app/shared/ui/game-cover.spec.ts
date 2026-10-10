import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GameCover, coverHue, coverInitials } from './game-cover';

@Component({
  imports: [GameCover],
  template: `<app-game-cover class="extra" [url]="url()" [name]="name()" size="sm" />`,
})
class Host {
  readonly url = signal<string | null>(null);
  readonly name = signal('Hollow Knight');
}

describe('GameCover', () => {
  function setup(url: string | null) {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.url.set(url);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, host: el.querySelector('app-game-cover') as HTMLElement };
  }

  it('renders a lazy, no-referrer image with the name as alt', () => {
    const { el, host } = setup('https://cdn.example.com/header.jpg');
    const img = el.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/header.jpg');
    expect(img.getAttribute('alt')).toBe('Hollow Knight');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(host.classList).toContain('extra');
    expect(host.classList).toContain('w-16');
  });

  it('shows the initials fallback without a url', () => {
    const { el } = setup(null);
    expect(el.querySelector('img')).toBeNull();
    const fallback = el.querySelector('[role="img"]')!;
    expect(fallback.getAttribute('aria-label')).toBe('Hollow Knight');
    expect(fallback.textContent?.trim()).toBe('HK');
  });

  it('falls back on load error and retries when the url changes', () => {
    const { fixture, el } = setup('https://cdn.example.com/broken.jpg');
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent?.trim()).toBe('HK');

    fixture.componentInstance.url.set('https://cdn.example.com/other.jpg');
    fixture.detectChanges();
    expect(el.querySelector('img')).not.toBeNull();
  });
});

describe('coverInitials / coverHue', () => {
  it('takes up to two initials, ignoring punctuation', () => {
    expect(coverInitials('The Legend of Zelda')).toBe('TL');
    expect(coverInitials('Celeste')).toBe('CE');
    expect(coverInitials('Hades II: Early Access')).toBe('HI');
    expect(coverInitials('  !!  ')).toBe('?');
  });

  it('is deterministic and within 0-359', () => {
    expect(coverHue('Celeste')).toBe(coverHue('Celeste'));
    const hue = coverHue('Elden Ring');
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });
});
