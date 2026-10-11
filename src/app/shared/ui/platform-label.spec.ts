import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { PlatformLabel, PlatformLabelValue } from './platform-label';

@Component({
  imports: [PlatformLabel],
  template: `<app-platform-label [platform]="platform()" />`,
})
class Host {
  readonly platform = signal<PlatformLabelValue>({ name: 'DS', color: '#E0524C' });
}

describe('PlatformLabel', () => {
  function setup(value: PlatformLabelValue) {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { platform: { MOBILE: 'Mobile', RETRO: 'Retro / Emulator' } });
    translate.use('en');
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.platform.set(value);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const dot = el.querySelector('span[aria-hidden="true"]') as HTMLElement;
    return { el, dot };
  }

  it('shows the name with a dot in the catalog color', () => {
    const { el, dot } = setup({ name: 'DS', color: '#E0524C' });
    expect(el.textContent).toContain('DS');
    expect(dot.style.backgroundColor).toBe('rgb(224, 82, 76)');
    expect(dot.classList).not.toContain('bg-platform-neutral');
  });

  it('falls back to the neutral dot without a valid color', () => {
    expect(setup({ name: 'Anbernic', color: null }).dot.classList).toContain('bg-platform-neutral');
    TestBed.resetTestingModule();
    const { dot } = setup({ name: 'Anbernic', color: 'red; background: url(x)' });
    expect(dot.classList).toContain('bg-platform-neutral');
    expect(dot.style.backgroundColor).toBe('');
  });

  it('translates the seeded Spanish names', () => {
    expect(setup({ name: 'Móvil', color: '#C2873A' }).el.textContent).toContain('Mobile');
  });
});
