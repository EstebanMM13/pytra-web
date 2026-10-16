import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AVATAR_CATEGORIES, AVATAR_KEYS } from '../../shared/ui/avatar-catalog';
import { AvatarPicker } from './avatar-picker';

@Component({
  imports: [AvatarPicker],
  template: `<app-avatar-picker
    [selected]="selected()"
    name="esteban"
    [exclusive]="exclusive()"
    [disabled]="disabled()"
    (picked)="picked.push($event)"
  />`,
})
class Host {
  readonly selected = signal<string | null>(null);
  readonly exclusive = signal<string[] | null>(null);
  readonly disabled = signal(false);
  readonly picked: (string | null)[] = [];
}

describe('AvatarPicker', () => {
  function setup(selected: string | null, exclusive: string[] | null = null) {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.selected.set(selected);
    fixture.componentInstance.exclusive.set(exclusive);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('button'));
    const byKey = (key: string) =>
      buttons.find((b) => b.getAttribute('aria-label') === 'profile.avatar.names.' + key)!;
    return { fixture, el, buttons, byKey };
  }

  it('offers the initial first, then every preset, each with an accessible name', () => {
    const { buttons } = setup(null);
    expect(buttons.length).toBe(AVATAR_KEYS.length + 1);
    expect(buttons[0].getAttribute('aria-label')).toBe('profile.avatar.none');
    expect(buttons.slice(1).map((b) => b.getAttribute('aria-label'))).toEqual(
      AVATAR_KEYS.map((k) => 'profile.avatar.names.' + k),
    );
  });

  it('groups presets under a translated heading per category', () => {
    const { el } = setup(null);
    const sections = Array.from(el.querySelectorAll('section'));
    expect(sections.map((s) => s.querySelector('h3')!.textContent!.trim())).toEqual(
      AVATAR_CATEGORIES.map((c) => 'profile.avatar.categories.' + c.id),
    );
    const animals = sections[3];
    expect(animals.getAttribute('aria-labelledby')).toBe(animals.querySelector('h3')!.id);
    expect(animals.querySelectorAll('button').length).toBe(8);
    const img = animals.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/avatars/zorro.svg');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('marks only the saved avatar as pressed', () => {
    const { buttons } = setup('fantasmapx');
    const pressed = buttons.filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.length).toBe(1);
    expect(pressed[0].getAttribute('aria-label')).toBe('profile.avatar.names.fantasmapx');
  });

  it('marks the initial as pressed when the saved key is unknown', () => {
    const { buttons } = setup('crown');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true').length).toBe(1);
  });

  it('emits the picked key, null for the initial, and nothing for the current one', () => {
    const { fixture, buttons, byKey } = setup('buho');
    byKey('buho').click();
    byKey('moneda').click();
    buttons[0].click();
    expect(fixture.componentInstance.picked).toEqual(['moneda', null]);
  });

  it('disables every option while saving', () => {
    const { fixture, buttons } = setup(null);
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });

  it('describes player types in the tooltip and aria-description, and only them', () => {
    const { byKey } = setup(null);
    const type = byKey('tipoexplorador');
    const description = 'profile.avatar.descriptions.tipoexplorador';
    expect(type.getAttribute('aria-description')).toBe(description);
    expect(type.title).toBe('profile.avatar.names.tipoexplorador — ' + description);
    expect(type.querySelector('img')!.getAttribute('src')).toBe('/avatars/tipoexplorador.svg');

    const genre = byKey('terror');
    expect(genre.hasAttribute('aria-description')).toBe(false);
    expect(genre.title).toBe('profile.avatar.names.terror');
  });

  describe('exclusive category', () => {
    const headings = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('h3')).map((h) => h.textContent!.trim());

    it('is shown first, with the WebP preset, when the API grants it', () => {
      const { el, buttons, byKey } = setup(null, ['estebanexplorador']);
      expect(headings(el)).toEqual([
        'profile.avatar.categories.exclusivo',
        ...AVATAR_CATEGORIES.map((c) => 'profile.avatar.categories.' + c.id),
      ]);
      expect(buttons.length).toBe(AVATAR_KEYS.length + 2);
      const exclusive = byKey('estebanexplorador');
      expect(exclusive.querySelector('img')!.getAttribute('src')).toBe('/avatars/estebanexplorador.webp');
    });

    it('lets the owner pick it and highlights it once saved', () => {
      const { fixture, byKey } = setup('estebanexplorador', ['estebanexplorador']);
      expect(byKey('estebanexplorador').getAttribute('aria-pressed')).toBe('true');
      byKey('mando').click();
      expect(fixture.componentInstance.picked).toEqual(['mando']);
    });

    for (const exclusive of [null, [], ['unknownexclusive']]) {
      it(`is hidden when the API grants ${JSON.stringify(exclusive)}`, () => {
        const { el, buttons, byKey } = setup(null, exclusive);
        expect(headings(el)).not.toContain('profile.avatar.categories.exclusivo');
        expect(buttons.length).toBe(AVATAR_KEYS.length + 1);
        expect(byKey('estebanexplorador')).toBeUndefined();
      });
    }
  });
});
