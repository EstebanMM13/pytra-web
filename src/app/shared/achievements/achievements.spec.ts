import { Game } from '../../core/models/game.model';
import { StatsSummary, YearStat } from '../../core/models/stats.model';
import { ACHIEVEMENT_CATEGORIES, computeAchievements, groupByCategory, sortAchievements, topUnlocked } from './achievements';

const game = (id: number, partial: Partial<Game> = {}): Game => ({
  id,
  name: `Game ${id}`,
  developer: null,
  publisher: null,
  releaseDate: null,
  category: 'SINGLEPLAYER',
  sagaId: null,
  sagaName: null,
  coverImageUrl: null,
  reviewStatus: 'CONFIRMED',
  genres: [],
  updatedAt: '2026-01-01',
  ...partial,
});

const summary = (partial: Partial<StatsSummary> = {}): StatsSummary => ({
  totalGames: 0,
  totalSagas: 0,
  totalExperiences: 0,
  totalSingleplayerHours: 0,
  totalOnlineHours: 0,
  totalPlatinums: 0,
  averageRating: null,
  replayCount: 0,
  completedCount: 0,
  abandonedCount: 0,
  inProgressCount: 0,
  ...partial,
});

const year = (y: number, experienceCount: number): YearStat => ({ year: y, totalHours: 1, experienceCount, averageRating: null });

const byId = (list: ReturnType<typeof computeAchievements>) => Object.fromEntries(list.map((a) => [a.id, a]));

describe('computeAchievements', () => {
  it('locks everything for an empty library', () => {
    const list = computeAchievements({ games: [], summary: summary(), sagas: [] });
    expect(list.length).toBe(40);
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length);
    expect(list.every((a) => !a.unlocked && a.progress === 0)).toBe(true);
    expect(list.every((a) => ACHIEVEMENT_CATEGORIES.includes(a.category))).toBe(true);
  });

  it('groups by category in display order', () => {
    const groups = groupByCategory(computeAchievements({ games: [], summary: summary(), sagas: [] }));
    expect(groups.map((g) => g.category)).toEqual([...ACHIEVEMENT_CATEGORIES]);
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(40);
  });

  it('derives hours, completion, replay and online tiers from the summary', () => {
    const a = byId(
      computeAchievements({
        games: [],
        summary: summary({ totalSingleplayerHours: 400, totalOnlineHours: 150, completedCount: 12, replayCount: 1, inProgressCount: 3 }),
        sagas: [],
      }),
    );
    expect(a['hours500'].unlocked).toBe(true);
    expect(a['hours1000'].progress).toBeCloseTo(0.55);
    expect(a['online100'].unlocked).toBe(true);
    expect(a['online500'].unlocked).toBe(false);
    expect(a['completed10'].unlocked).toBe(true);
    expect(a['completionist'].unlocked).toBe(true);
    expect(a['firstReplay'].unlocked && !a['replays5'].unlocked).toBe(true);
    expect(a['multitasker'].unlocked).toBe(true);
  });

  it('resets the completionist badge when a run was abandoned', () => {
    const a = byId(computeAchievements({ games: [], summary: summary({ completedCount: 30, abandonedCount: 1 }), sagas: [] }));
    expect(a['completionist'].current).toBe(0);
  });

  it('derives rating badges from best ratings', () => {
    const games = [10, 9, 9.5, 9, 9, 3].map((r, i) => game(i + 1, { bestRating: r }));
    const a = byId(computeAchievements({ games, summary: null, sagas: [] }));
    expect(a['perfectTen'].unlocked).toBe(true);
    expect(a['masterpieces'].unlocked).toBe(true);
    expect(a['harshCritic'].unlocked).toBe(true);
  });

  it('tracks category variety and online debut on played games only', () => {
    const games = [
      game(1, { category: 'SINGLEPLAYER', experienceCount: 1 }),
      game(2, { category: 'HYBRID', experienceCount: 1 }),
      game(3, { category: 'ONLINE', experienceCount: 0 }),
    ];
    const a = byId(computeAchievements({ games, summary: null, sagas: [] }));
    expect(a['onlineDebut'].unlocked).toBe(true);
    expect(a['variety'].current).toBe(2);
  });

  it('unlocks tiers from the summary with clamped progress', () => {
    const a = byId(computeAchievements({ games: [], summary: summary({ totalPlatinums: 4, totalExperiences: 60, totalGames: 30 }), sagas: [] }));
    expect(a['firstPlatinum'].unlocked).toBe(true);
    expect(a['platinumHunter'].progress).toBeCloseTo(0.4);
    expect(a['runs10'].unlocked && a['runs50'].unlocked).toBe(true);
    expect(a['runs100'].unlocked).toBe(false);
    expect(a['collector25'].unlocked).toBe(true);
    expect(a['collector50'].progress).toBeCloseTo(0.6);
    expect(a['runs10'].progress).toBe(1);
  });

  it('derives game-based badges (marathon, platforms, critic)', () => {
    const games = [
      game(1, { totalHours: 120, platforms: ['PC', 'PS5'], bestRating: 9 }),
      game(2, { totalHours: 10, platforms: ['PC', 'SWITCH'], bestRating: null }),
    ];
    const a = byId(computeAchievements({ games, summary: null, sagas: [] }));
    expect(a['marathon'].unlocked).toBe(true);
    expect(a['platforms'].current).toBe(3);
    expect(a['platforms'].unlocked).toBe(true);
    expect(a['critic'].current).toBe(1);
    expect(a['collector25'].current).toBe(2);
  });

  it('completes a saga only when every game (>= 2) has runs', () => {
    const sagas = [
      { id: 1, name: 'Solo', updatedAt: '' },
      { id: 2, name: 'Duo', updatedAt: '' },
    ];
    const partial = [
      game(1, { sagaId: 1, experienceCount: 1 }),
      game(2, { sagaId: 2, experienceCount: 1 }),
      game(3, { sagaId: 2, experienceCount: 0 }),
    ];
    let a = byId(computeAchievements({ games: partial, summary: null, sagas }));
    expect(a['sagaComplete'].unlocked).toBe(false);
    expect(a['sagaComplete'].progress).toBeCloseTo(0.5);

    const full = [...partial.slice(0, 2), game(3, { sagaId: 2, experienceCount: 2 })];
    a = byId(computeAchievements({ games: full, summary: null, sagas }));
    expect(a['sagaComplete'].unlocked).toBe(true);
    expect(a['sagaTrilogy'].current).toBe(0);

    const trilogy = [1, 2, 3].map((id) => game(id, { sagaId: 2, experienceCount: 1, lastExperienceStatus: 'COMPLETADO' }));
    expect(byId(computeAchievements({ games: trilogy, summary: null, sagas }))['sagaTrilogy'].unlocked).toBe(true);
  });

  it('counts veteran years with runs only', () => {
    const years = [year(2020, 1), year(2021, 2), year(2022, 0), year(2023, 1), year(2024, 1), year(2025, 3)];
    const a = byId(computeAchievements({ games: [], summary: null, sagas: [], years }));
    expect(a['veteran'].unlocked).toBe(true);
    expect(a['years10'].current).toBe(5);
    expect(a['streak3'].current).toBe(3);
    expect(a['streak3'].unlocked).toBe(true);
  });

  it('sorts unlocked first and picks the hardest unlocked', () => {
    const list = computeAchievements({ games: [], summary: summary({ totalPlatinums: 1, totalExperiences: 12 }), sagas: [] });
    const sorted = sortAchievements(list);
    expect(sorted.slice(0, 2).map((a) => a.id)).toEqual(['firstPlatinum', 'runs10']);
    expect(sorted[2].unlocked).toBe(false);
    expect(topUnlocked(list).map((a) => a.id)).toEqual(['firstPlatinum', 'runs10']);
    const gold = computeAchievements({ games: [], summary: summary({ totalPlatinums: 10 }), sagas: [] });
    expect(topUnlocked(gold, 1)[0].id).toBe('platinumHunter');
    expect(topUnlocked(computeAchievements({ games: [], summary: summary(), sagas: [] }))).toEqual([]);
  });
});
