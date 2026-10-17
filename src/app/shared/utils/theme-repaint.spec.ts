import { THEME_SWITCHING_ATTR, applyWithRepaint, resetRepaintStateForTests } from './theme-repaint';

describe('applyWithRepaint', () => {
  let frames: (() => void)[];
  const nextFrame = (callback: () => void) => frames.push(callback);
  const flushFrame = () => {
    const current = frames;
    frames = [];
    current.forEach((callback) => callback());
  };

  beforeEach(() => {
    frames = [];
    resetRepaintStateForTests();
  });

  it('applies the change while <html> is flagged, then clears the flag two frames later', () => {
    const root = document.createElement('div');
    let flaggedDuringApply = false;

    applyWithRepaint(
      () => (flaggedDuringApply = THEME_SWITCHING_ATTR in root.dataset),
      root,
      nextFrame,
    );

    expect(flaggedDuringApply).toBe(true);
    expect(THEME_SWITCHING_ATTR in root.dataset).toBe(true);
    flushFrame();
    expect(THEME_SWITCHING_ATTR in root.dataset).toBe(true);
    flushFrame();
    expect(THEME_SWITCHING_ATTR in root.dataset).toBe(false);
  });

  it('keeps the flag until the last of overlapping switches settles', () => {
    const root = document.createElement('div');
    applyWithRepaint(() => undefined, root, nextFrame);
    flushFrame();
    applyWithRepaint(() => undefined, root, nextFrame);
    flushFrame(); // first switch settles, second is half-way
    expect(THEME_SWITCHING_ATTR in root.dataset).toBe(true);
    flushFrame();
    expect(THEME_SWITCHING_ATTR in root.dataset).toBe(false);
  });

  it('still applies the change without a root element', () => {
    let applied = false;
    applyWithRepaint(() => (applied = true), null, nextFrame);
    expect(applied).toBe(true);
    expect(frames.length).toBe(0);
  });
});
