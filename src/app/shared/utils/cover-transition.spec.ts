import { describe, expect, it } from 'vitest';
import { COVER_TRANSITION_NAME, markCoverTransition, posterTransitionName } from './cover-transition';

describe('cover transition', () => {
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

  it('matches the name the game detail hero uses', () => {
    expect(COVER_TRANSITION_NAME).toBe('game-cover');
  });
});
