import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Avatar, avatarInitial } from './avatar';

@Component({
  imports: [Avatar],
  template: `<app-avatar
    class="extra"
    size="lg"
    [avatar]="avatar()"
    [name]="name()"
    [lazy]="lazy()"
  />`,
})
class Host {
  readonly avatar = signal<string | null>(null);
  readonly name = signal<string | null>('esteban');
  readonly lazy = signal(false);
}

describe('Avatar', () => {
  function setup(avatar: string | null, name: string | null = 'esteban', lazy = false) {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.avatar.set(avatar);
    fixture.componentInstance.name.set(name);
    fixture.componentInstance.lazy.set(lazy);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, host: el.querySelector('app-avatar') as HTMLElement };
  }

  it('shows the initial on brand tint without an avatar', () => {
    const { host } = setup(null);
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent?.trim()).toBe('E');
    expect(host.classList).toContain('bg-brand-tint');
    expect(host.classList).toContain('extra');
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });

  it('falls back to the initial for an unknown or retired key and "?" without a name', () => {
    expect(setup('dragon').host.textContent?.trim()).toBe('E');
    TestBed.resetTestingModule();
    expect(setup('ghost').host.querySelector('img')).toBeNull();
    TestBed.resetTestingModule();
    expect(setup(null, null).host.textContent?.trim()).toBe('?');
  });

  it('renders the preset SVG as a decorative, circle-cropped image', () => {
    const { host } = setup('zorro');
    const img = host.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/avatars/zorro.svg');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.hasAttribute('loading')).toBe(false);
    expect(img.classList).toContain('object-cover');
    expect(img.classList).toContain('rounded-full');
    expect(host.textContent?.trim()).toBe('');
    expect(host.classList).not.toContain('bg-brand-tint');
  });

  it('loads lazily when asked to', () => {
    const { host } = setup('buho', 'esteban', true);
    expect(host.querySelector('img')!.getAttribute('loading')).toBe('lazy');
  });

  it('switches back to the initial when the avatar is cleared', () => {
    const { fixture, host } = setup('mando');
    fixture.componentInstance.avatar.set(null);
    fixture.detectChanges();
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent?.trim()).toBe('E');
  });
});

describe('avatarInitial', () => {
  it('uses the first letter, uppercased', () => {
    expect(avatarInitial('esteban')).toBe('E');
    expect(avatarInitial('  ')).toBe('?');
    expect(avatarInitial(null)).toBe('?');
  });
});
