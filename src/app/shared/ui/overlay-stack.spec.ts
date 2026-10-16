import { closeOverlay, isTopOverlay, openOverlay } from './overlay-stack';

describe('overlay stack', () => {
  it('locks page scroll while any overlay is open and tracks the top one', () => {
    const body = document.createElement('div');
    body.style.overflow = 'auto';
    const a = {};
    const b = {};
    openOverlay(a, body);
    openOverlay(b, body);
    expect(body.style.overflow).toBe('hidden');
    expect(isTopOverlay(b)).toBe(true);
    expect(isTopOverlay(a)).toBe(false);

    closeOverlay(a, body);
    expect(body.style.overflow).toBe('hidden');
    expect(isTopOverlay(b)).toBe(true);
    closeOverlay(b, body);
    expect(body.style.overflow).toBe('auto');
    expect(isTopOverlay(b)).toBe(false);
    // Closing twice is harmless.
    closeOverlay(b, body);
    expect(body.style.overflow).toBe('auto');
  });
});
