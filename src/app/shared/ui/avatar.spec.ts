import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AVATARS, Avatar, avatarInitial, findAvatar } from './avatar';

@Component({
  imports: [Avatar],
  template: `<app-avatar class="extra" size="lg" [avatar]="avatar()" [name]="name()" />`,
})
class Host {
  readonly avatar = signal<string | null>(null);
  readonly name = signal<string | null>('esteban');
}

describe('Avatar', () => {
  function setup(avatar: string | null, name: string | null = 'esteban') {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.avatar.set(avatar);
    fixture.componentInstance.name.set(name);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, host: el.querySelector('app-avatar') as HTMLElement };
  }

  it('shows the initial on brand tint without an avatar', () => {
    const { host } = setup(null);
    expect(host.querySelector('svg')).toBeNull();
    expect(host.textContent?.trim()).toBe('E');
    expect(host.classList).toContain('bg-brand-tint');
    expect(host.classList).toContain('extra');
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });

  it('falls back to the initial for an unknown key and "?" without a name', () => {
    expect(setup('dragon').host.textContent?.trim()).toBe('E');
    TestBed.resetTestingModule();
    expect(setup(null, null).host.textContent?.trim()).toBe('?');
  });

  it('renders the preset icon on its gradient', () => {
    const { host } = setup('ghost');
    expect(host.querySelector('svg')).not.toBeNull();
    expect(host.textContent?.trim()).toBe('');
    expect(host.classList).not.toContain('bg-brand-tint');
    expect(host.style.background).toContain('linear-gradient');
  });

  it('switches back to the initial when the avatar is cleared', () => {
    const { fixture, host } = setup('crown');
    fixture.componentInstance.avatar.set(null);
    fixture.detectChanges();
    expect(host.querySelector('svg')).toBeNull();
    expect(host.textContent?.trim()).toBe('E');
    expect(host.style.background).toBe('');
  });
});

describe('avatar catalog', () => {
  it('matches the API allowlist (AvatarPolicy.KEYS) exactly', () => {
    expect(AVATARS.map((a) => a.key).sort()).toEqual([
      'castle',
      'crown',
      'flame',
      'gamepad',
      'ghost',
      'joystick',
      'rocket',
      'shield',
      'skull',
      'swords',
      'trophy',
      'zap',
    ]);
  });

  it('finds presets by key only', () => {
    expect(findAvatar('zap')?.key).toBe('zap');
    expect(findAvatar('ZAP')).toBeNull();
    expect(findAvatar('')).toBeNull();
    expect(findAvatar(undefined)).toBeNull();
  });

  it('uses the first letter, uppercased', () => {
    expect(avatarInitial('esteban')).toBe('E');
    expect(avatarInitial('  ')).toBe('?');
    expect(avatarInitial(null)).toBe('?');
  });
});
