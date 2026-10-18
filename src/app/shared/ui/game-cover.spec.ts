import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_ORIGIN } from '../../core/api-base-url';
import { setMotionPreference } from '../utils/motion';
import {
  GameCover,
  GameCoverSize,
  REVEAL_IN_CLASS,
  REVEAL_PENDING_CLASS,
  revealDelay,
  coverHue,
  coverInitials,
  fitsPortraitBox,
  steamHeaderFallback,
  steamCoverFallbacks,
  nextCoverSource,
  sizedCoverUrl,
  steamPortraitCoverUrl,
} from './game-cover';

@Component({
  imports: [GameCover],
  template: `<app-game-cover
    class="extra"
    [url]="url()"
    [name]="name()"
    [priority]="priority()"
    [size]="size()"
  />`,
})
class Host {
  readonly url = signal<string | null>(null);
  readonly name = signal('Hollow Knight');
  readonly priority = signal(false);
  readonly size = signal<GameCoverSize>('sm');
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
    expect(host.classList).toContain('w-9');
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
    // A small box first asks the API for a thumbnail, then the capsule itself.
    expect(el.querySelector('img')!.getAttribute('src')).toBe(sizedCoverUrl(capsule, 'small'));
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')!.getAttribute('src')).toBe(capsule);

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

  it('requests the small IGDB cover in a small box and the big one in a large box', () => {
    const igdb = (size: string) => `https://images.igdb.com/igdb/image/upload/${size}/co1abc.jpg`;
    const { fixture, el } = setup(igdb('t_cover_big'));
    expect(el.querySelector('img')!.getAttribute('src')).toBe(igdb('t_cover_small_2x'));
    expect(el.querySelector('img')!.getAttribute('decoding')).toBe('async');

    fixture.componentInstance.size.set('hero');
    fixture.detectChanges();
    expect(el.querySelector('img')!.getAttribute('src')).toBe(igdb('t_cover_big'));
  });

  it('retries the original url when the resized IGDB cover fails, then shows the initials', () => {
    const igdb = (size: string) => `https://images.igdb.com/igdb/image/upload/${size}/co1abc.jpg`;
    const { fixture, el } = setup(igdb('t_cover_big'));
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')!.getAttribute('src')).toBe(igdb('t_cover_big'));
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
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
    expect(
      steamHeaderFallback(
        'https://cdn.cloudflare.steamstatic.com/steam/apps/620/library_600x900_2x.jpg?t=1',
      ),
    ).toBe('https://cdn.cloudflare.steamstatic.com/steam/apps/620/header.jpg');
  });

  it('walks the fallback chain: library capsule, header, main capsule, then initials', () => {
    const base = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1030300/';
    const url = `${base}library_600x900.jpg`;
    expect(steamCoverFallbacks(url)).toEqual([`${base}header.jpg`, `${base}capsule_616x353.jpg`]);
    expect(nextCoverSource(url, url)).toBe(`${base}header.jpg`);
    expect(nextCoverSource(url, `${base}header.jpg`)).toBe(`${base}capsule_616x353.jpg`);
    expect(nextCoverSource(url, `${base}capsule_616x353.jpg`)).toBeNull();
    expect(
      nextCoverSource(
        'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg',
        'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg',
      ),
    ).toBeNull();
    expect(nextCoverSource(null, url)).toBeNull();
  });

  it('recognises the older steamcdn host', () => {
    expect(
      steamHeaderFallback('https://steamcdn-a.akamaihd.net/steam/apps/1030300/library_600x900.jpg'),
    ).toBe('https://steamcdn-a.akamaihd.net/steam/apps/1030300/header.jpg');
  });

  it('has no fallback for other urls', () => {
    expect(
      steamHeaderFallback(
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg',
      ),
    ).toBeNull();
    expect(
      steamHeaderFallback('https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg'),
    ).toBeNull();
    expect(
      steamHeaderFallback('https://evil.example.com/steam/apps/620/library_600x900.jpg'),
    ).toBeNull();
  });
});

describe('sizedCoverUrl', () => {
  const igdb = (size: string) => `https://images.igdb.com/igdb/image/upload/${size}/co1abc.jpg`;

  it('rewrites the size segment of IGDB urls', () => {
    expect(sizedCoverUrl(igdb('t_cover_big'), 'small')).toBe(igdb('t_cover_small_2x'));
    expect(sizedCoverUrl(igdb('t_1080p'), 'small')).toBe(igdb('t_cover_small_2x'));
    expect(sizedCoverUrl(igdb('t_cover_big_2x'), 'small')).toBe(igdb('t_cover_small_2x'));
    expect(sizedCoverUrl('//images.igdb.com/igdb/image/upload/t_cover_big/co1.png', 'small')).toBe(
      '//images.igdb.com/igdb/image/upload/t_cover_small_2x/co1.png',
    );
  });

  it('keeps big boxes and already-small IGDB images as they are', () => {
    expect(sizedCoverUrl(igdb('t_cover_big'), 'big')).toBe(igdb('t_cover_big'));
    expect(sizedCoverUrl(igdb('t_cover_small'), 'small')).toBe(igdb('t_cover_small'));
    expect(sizedCoverUrl(igdb('t_thumb'), 'small')).toBe(igdb('t_thumb'));
  });

  it('sends small Steam capsules through the API thumbnail endpoint', () => {
    const steam = steamPortraitCoverUrl(620);
    const sized = sizedCoverUrl(steam, 'small');
    expect(sized).toBe(`${API_ORIGIN}/api/v1/covers/thumb?url=${encodeURIComponent(steam)}&w=180`);
    expect(sizedCoverUrl(steam, 'big')).toBe(steam);
    // A failed thumbnail falls back to the original capsule.
    expect(nextCoverSource(steam, sized!, sized)).toBe(steam);
  });

  it('leaves other urls unchanged', () => {
    expect(
      sizedCoverUrl('https://evil.example.com/igdb/image/upload/t_cover_big/co1.jpg', 'small'),
    ).toBe('https://evil.example.com/igdb/image/upload/t_cover_big/co1.jpg');
  });

  it('is null-safe', () => {
    expect(sizedCoverUrl(null, 'small')).toBeNull();
    expect(sizedCoverUrl(undefined, 'big')).toBeNull();
    expect(sizedCoverUrl('', 'small')).toBeNull();
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
  it('crops any reasonably portrait art (up to 20% wider than the 3:4 box, 0.9)', () => {
    expect(fitsPortraitBox(600, 900)).toBe(true);
    expect(fitsPortraitBox(264, 374)).toBe(true);
    expect(fitsPortraitBox(3, 4)).toBe(true);
    expect(fitsPortraitBox(800, 1000)).toBe(true);
    expect(fitsPortraitBox(300, 600)).toBe(true);
    expect(fitsPortraitBox(840, 1000)).toBe(true);
    expect(fitsPortraitBox(890, 1000)).toBe(true);
  });

  it('letterboxes only clearly non-portrait art (square or landscape)', () => {
    expect(fitsPortraitBox(920, 1000)).toBe(false);
    expect(fitsPortraitBox(512, 512)).toBe(false);
    expect(fitsPortraitBox(460, 215)).toBe(false);
  });

  it('treats a missing size as portrait (nothing to decide yet)', () => {
    expect(fitsPortraitBox(0, 0)).toBe(true);
    expect(fitsPortraitBox(Number.NaN, 900)).toBe(true);
  });
});

describe('GameCover scroll reveal', () => {
  let observers: { callback: IntersectionObserverCallback; targets: Set<Element> }[];

  function fire(target: Element, isIntersecting: boolean): void {
    const observer = observers.find((o) => o.targets.has(target))!;
    observer.callback([{ target, isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  }

  beforeEach(() => {
    observers = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        readonly targets = new Set<Element>();
        constructor(readonly callback: IntersectionObserverCallback) {
          observers.push(this);
        }
        observe(el: Element) {
          this.targets.add(el);
        }
        unobserve(el: Element) {
          this.targets.delete(el);
        }
        disconnect() {
          this.targets.clear();
        }
      },
    );
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => undefined }));
    TestBed.configureTestingModule({ imports: [Host] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setMotionPreference('system');
    delete document.documentElement.dataset['motion'];
  });

  function setup(size: GameCoverSize = 'fill', priority = false) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.size.set(size);
    fixture.componentInstance.priority.set(priority);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('app-game-cover') as HTMLElement;
  }

  it('never hides a cover that is on screen at first paint', () => {
    const host = setup();
    fire(host, true);
    expect(host.classList).not.toContain(REVEAL_PENDING_CLASS);
    expect(host.classList).not.toContain(REVEAL_IN_CLASS);
    expect(observers[0].targets.has(host)).toBe(false);
  });

  it('hides an off-screen cover, then fades it in once and stops observing it', () => {
    const host = setup();
    fire(host, false);
    expect(host.classList).toContain(REVEAL_PENDING_CLASS);

    fire(host, true);
    expect(host.classList).not.toContain(REVEAL_PENDING_CLASS);
    expect(host.classList).toContain(REVEAL_IN_CLASS);
    expect(host.style.getPropertyValue('--reveal-delay')).toBe('0ms');
    expect(observers[0].targets.has(host)).toBe(false);

    host.dispatchEvent(new Event('animationend'));
    expect(host.classList).not.toContain(REVEAL_IN_CLASS);
  });

  it('skips hero / priority covers and reduced motion', () => {
    setup('hero');
    setup('lg', true);
    expect(observers).toHaveLength(0);

    setMotionPreference('reduce');
    setup('sm');
    expect(observers).toHaveLength(0);
  });

  it('staggers covers revealed together, capped', () => {
    expect(revealDelay(0)).toBe(0);
    expect(revealDelay(2)).toBe(90);
    expect(revealDelay(50)).toBe(revealDelay(8));
  });
});
