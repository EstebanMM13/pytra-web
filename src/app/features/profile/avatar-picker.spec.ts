import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AVATARS } from '../../shared/ui/avatar';
import { AvatarPicker } from './avatar-picker';

@Component({
  imports: [AvatarPicker],
  template: `<app-avatar-picker
    [selected]="selected()"
    name="esteban"
    [disabled]="disabled()"
    (picked)="picked.push($event)"
  />`,
})
class Host {
  readonly selected = signal<string | null>(null);
  readonly disabled = signal(false);
  readonly picked: (string | null)[] = [];
}

describe('AvatarPicker', () => {
  function setup(selected: string | null) {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.selected.set(selected);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('button'));
    return { fixture, buttons };
  }

  it('offers the initial plus every preset, each with an accessible name', () => {
    const { buttons } = setup(null);
    expect(buttons.length).toBe(AVATARS.length + 1);
    expect(buttons[0].getAttribute('aria-label')).toBe('profile.avatar.none');
    expect(buttons[1].getAttribute('aria-label')).toBe('profile.avatar.names.' + AVATARS[0].key);
  });

  it('marks only the saved avatar as pressed', () => {
    const { buttons } = setup('ghost');
    const pressed = buttons.filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.length).toBe(1);
    expect(pressed[0].getAttribute('aria-label')).toBe('profile.avatar.names.ghost');
  });

  it('marks the initial as pressed when the saved key is unknown', () => {
    const { buttons } = setup('dragon');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('emits the picked key, null for the initial, and nothing for the current one', () => {
    const { fixture, buttons } = setup('ghost');
    const ghost = buttons.find(
      (b) => b.getAttribute('aria-label') === 'profile.avatar.names.ghost',
    )!;
    const crown = buttons.find(
      (b) => b.getAttribute('aria-label') === 'profile.avatar.names.crown',
    )!;
    ghost.click();
    crown.click();
    buttons[0].click();
    expect(fixture.componentInstance.picked).toEqual(['crown', null]);
  });

  it('disables every option while saving', () => {
    const { fixture, buttons } = setup(null);
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});
