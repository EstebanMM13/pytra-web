import { TestBed } from '@angular/core/testing';
import { PytraWordmark } from './pytra-wordmark';

describe('PytraWordmark', () => {
  it('reads as "Pytra" and tints the P, t and r of the slogan', () => {
    const fixture = TestBed.createComponent(PytraWordmark);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe('Pytra');
    expect(host.textContent?.replace(/\s/g, '')).toBe('Pytra');
    const tinted = [...host.querySelectorAll('.text-brand-light')].map((el) => el.textContent).join('');
    expect(tinted).toBe('Ptr');
  });
});
