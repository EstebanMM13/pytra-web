import { afterEach, describe, expect, it } from 'vitest';
import { COVER_TRANSITION_NAME, markCoverTransition, posterTransitionName, resetCoverTransition } from './cover-transition';

function poster(): { link: HTMLAnchorElement; cover: HTMLElement } {
  const link = document.createElement('a');
  const cover = document.createElement('app-game-cover');
  link.appendChild(cover);
  return { link, cover };
}

describe('cover transition', () => {
  afterEach(() => resetCoverTransition());

  it('names only the poster of the tapped game', () => {
    markCoverTransition(7);
    expect(posterTransitionName(7)).toBe(COVER_TRANSITION_NAME);
    expect(posterTransitionName(8)).toBeNull();
  });

  it('moves the name when another poster is tapped', () => {
    markCoverTransition(7);
    markCoverTransition(8);
    expect(posterTransitionName(7)).toBeNull();
    expect(posterTransitionName(8)).toBe(COVER_TRANSITION_NAME);
  });

  it('names the tapped poster immediately, before any re-render', () => {
    const { link, cover } = poster();
    markCoverTransition(7, link);
    expect(cover.style.getPropertyValue('view-transition-name')).toBe(COVER_TRANSITION_NAME);
  });

  it('unnames the previous poster when another one is tapped, so only one carries the name', () => {
    const first = poster();
    const second = poster();
    markCoverTransition(7, first.link);
    markCoverTransition(9, second.link);
    expect(first.cover.style.getPropertyValue('view-transition-name')).toBe('');
    expect(second.cover.style.getPropertyValue('view-transition-name')).toBe(COVER_TRANSITION_NAME);
  });

  it('unnames the poster when the selection is cleared', () => {
    const { link, cover } = poster();
    markCoverTransition(7, link);
    resetCoverTransition();
    expect(cover.style.getPropertyValue('view-transition-name')).toBe('');
    expect(posterTransitionName(7)).toBeNull();
  });

  it('matches route ids given as strings', () => {
    markCoverTransition(7);
    expect(posterTransitionName('7')).toBe(COVER_TRANSITION_NAME);
  });

  it('matches the name the game detail hero uses', () => {
    expect(COVER_TRANSITION_NAME).toBe('game-cover');
  });
});
