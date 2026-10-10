import { TestBed } from '@angular/core/testing';
import { BeforeInstallPromptEvent, InstallPromptService } from './install-prompt.service';

function fakePromptEvent(outcome: 'accepted' | 'dismissed'): BeforeInstallPromptEvent & { prompted: boolean } {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent & {
    prompted: boolean;
  };
  event.prompted = false;
  Object.assign(event, {
    prompt: async () => {
      event.prompted = true;
    },
    userChoice: Promise.resolve({ outcome }),
  });
  return event;
}

describe('InstallPromptService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('cannot install until the browser offers a prompt', () => {
    const service = TestBed.inject(InstallPromptService);
    expect(service.canInstall()).toBe(false);
    expect(service.showBanner()).toBe(false);
  });

  it('captures beforeinstallprompt and prompts once on install()', async () => {
    const service = TestBed.inject(InstallPromptService);
    const event = fakePromptEvent('accepted');
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(service.canInstall()).toBe(true);
    expect(service.showBanner()).toBe(true);

    await expect(service.install()).resolves.toBe(true);
    expect(event.prompted).toBe(true);
    expect(service.canInstall()).toBe(false);
    await expect(service.install()).resolves.toBe(false);
  });

  it('clears the prompt and marks installed on appinstalled', () => {
    const service = TestBed.inject(InstallPromptService);
    window.dispatchEvent(fakePromptEvent('dismissed'));
    window.dispatchEvent(new Event('appinstalled'));

    expect(service.canInstall()).toBe(false);
    expect(service.installed()).toBe(true);
  });

  it('remembers the dashboard banner dismissal', () => {
    const service = TestBed.inject(InstallPromptService);
    window.dispatchEvent(fakePromptEvent('dismissed'));
    service.dismissBanner();

    expect(service.showBanner()).toBe(false);
    expect(service.canInstall()).toBe(true);
    expect(localStorage.getItem('pytra_install_banner_dismissed')).toBe('1');
  });
});
