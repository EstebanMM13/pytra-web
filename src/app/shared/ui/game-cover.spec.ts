import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  GameCover,
  coverHue,
  coverInitials,
  fitsPortraitBox,
  steamHeaderFallback,
  steamCoverFallbacks,
  nextCoverSource,
  steamPortraitCoverUrl,
} from './game-cover';

@Component({
  imports: [GameCover],
  template: `<app-game-cover class="extra" [url]="url()" [name]="name()" [priority]="priority()" size="sm" />`,
})
class Host {
  readonly url = signal<string | null>(null);
  readonly name = signal('Hollow Knight');
  readonly priority = signal(false);
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

  function load(img: HTMLImageElement, width: number, height: number) {
    Object.defineProperty(img, 'naturalWidth', { value: width });
    Object.defineProperty(img, 'naturalHeight', { value: height });
    img.dispatchEvent(new Event('load'));
  }

  it('renders a lazy, no-referrer image with the name as alt in a portrait box', () => {
    const { el, host } = setup('https://cdn.example.com/cover.jpg');
    const img = el.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/cover.jpg');
    expect(img.getAttribute('alt')).toBe('Hollow Knight');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(host.classList).toContain('extra');
    expect(host.classList).toContain('w-8');
    expect(host.classList).toContain('h-12');
  });

  it('has no fetch priority by default and loads a priority (hero) cover eagerly at high priority', () => {
    const { fixture, el } = setup('https://cdn.example.com/cover.jpg');
    expect(el.querySelector('img')!.hasAttribute('fetchpriority')).toBe(false);
    fixture.componentInstance.priority.set(true);
    fixture.detectChanges();
    const img = el.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });

  it('crops portrait art to fill the box', () => {
    const { fixture, el } = setup('https://images.example.com/cover.jpg');
    load(el.querySelector('img')!, 264, 374);
    fixture.detectChanges();
    expect(el.querySelectorAll('img').length).toBe(1);
    expect(el.querySelector('img')!.classList).toContain('object-cover');
    expect(el.querySelector('img')!.classList).toContain('object-top');
  });

  it('shows landscape art whole over a blurred backdrop', () => {
    const { fixture, el } = setup('https://images.example.com/header.jpg');
    load(el.querySelector('img')!, 460, 215);
    fixture.detectChanges();
    const imgs = el.querySelectorAll('img');
    expect(imgs.length).toBe(2);
    expect(imgs[0].getAttribute('aria-hidden')).toBe('true');
    expect(imgs[1].classList).toContain('object-contain');
  });

  it('retries a failed Steam library capsule with the header and the main capsule, then shows the initials', () => {
    const capsule = steamPortraitCoverUrl(70);
    const { fixture, el } = setup(capsule);
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')!.getAttribute('src')).toBe(
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/70/header.jpg',
    );

    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')!.getAttribute('src')).toBe(
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/70/capsule_616x353.jpg',
    );

    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent?.trim()).toBe('HK');
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

describe('steam cover urls', () => {
  it('builds the portrait library capsule from an appid', () => {
    expect(steamPortraitCoverUrl(1245620)).toBe(
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/library_600x900.jpg',
    );
  });

  it('falls back from a library capsule to the header of the same app and host', () => {
    expect(steamHeaderFallback(steamPortraitCoverUrl(620))).toBe(
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg',
    );
    expect(steamHeaderFallback('https://cdn.cloudflare.steamstatic.com/steam/apps/620/library_600x900_2x.jpg?t=1')).toBe(
      'https://cdn.cloudflare.steamstatic.com/steam/apps/620/header.jpg',
    );
  });

  it('walks the fallback chain: library capsule, header, main capsule, then initials', () => {
    const base = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1030300/';
    const url = `${base}library_600x900.jpg`;
    expect(steamCoverFallbacks(url)).toEqual([`${base}header.jpg`, `${base}capsule_616x353.jpg`]);
    expect(nextCoverSource(url, url)).toBe(`${base}header.jpg`);
    expect(nextCoverSource(url, `${base}header.jpg`)).toBe(`${base}capsule_616x353.jpg`);
    expect(nextCoverSource(url, `${base}capsule_616x353.jpg`)).toBeNull();
    expect(nextCoverSource('https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg')).toBeNull();
    expect(nextCoverSource(null, url)).toBeNull();
  });

  it('recognises the older steamcdn host', () => {
    expect(steamHeaderFallback('https://steamcdn-a.akamaihd.net/steam/apps/1030300/library_600x900.jpg')).toBe(
      'https://steamcdn-a.akamaihd.net/steam/apps/1030300/header.jpg',
    );
  });

  it('has no fallback for other urls', () => {
    expect(steamHeaderFallback('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg')).toBeNull();
    expect(steamHeaderFallback('https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg')).toBeNull();
    expect(steamHeaderFallback('https://evil.example.com/steam/apps/620/library_600x900.jpg')).toBeNull();
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

describe('fitsPortraitBox', () => {
  it('crops any reasonably portrait art (width / height up to 0.80)', () => {
    expect(fitsPortraitBox(600, 900)).toBe(true);
    expect(fitsPortraitBox(264, 374)).toBe(true);
    expect(fitsPortraitBox(3, 4)).toBe(true);
    expect(fitsPortraitBox(800, 1000)).toBe(true);
    expect(fitsPortraitBox(300, 600)).toBe(true);
  });

  it('letterboxes only clearly non-portrait art (square or landscape)', () => {
    expect(fitsPortraitBox(810, 1000)).toBe(false);
    expect(fitsPortraitBox(512, 512)).toBe(false);
    expect(fitsPortraitBox(460, 215)).toBe(false);
  });

  it('treats a missing size as portrait (nothing to decide yet)', () => {
    expect(fitsPortraitBox(0, 0)).toBe(true);
    expect(fitsPortraitBox(Number.NaN, 900)).toBe(true);
  });
});
