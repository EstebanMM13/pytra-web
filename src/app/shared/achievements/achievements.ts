import { Game } from '../../core/models/game.model';
import { Saga } from '../../core/models/saga.model';
import { StatsSummary, YearStat } from '../../core/models/stats.model';

export type AchievementCategory =
  | 'collection'
  | 'runs'
  | 'hours'
  | 'ratings'
  | 'platinums'
  | 'fullCompletions'
  | 'sagas'
  | 'platforms'
  | 'years'
  | 'online'
  | 'special';

/** Display order of the categories (also the i18n keys `achievements.categories.{id}`). */
export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = [
  'collection',
  'runs',
  'hours',
  'ratings',
  'platinums',
  'fullCompletions',
  'sagas',
  'platforms',
  'years',
  'online',
  'special',
];

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface Achievement {
  /** Also the i18n key: `achievements.items.{id}.title|desc`. */
  id: string;
  category: AchievementCategory;
  tier: AchievementTier;
  current: number;
  target: number;
  unlocked: boolean;
  /** 0..1, clamped. */
  progress: number;
  /** Higher = harder; used to pick the most impressive unlocked badges. */
  rank: number;
}

export interface AchievementInput {
  games: readonly Game[];
  summary: StatsSummary | null;
  sagas: readonly Saga[];
  years?: readonly YearStat[] | null;
}

const TIER_WEIGHT: Record<AchievementTier, number> = { bronze: 0, silver: 1, gold: 2 };
/** The meta badge unlocked by unlocking every other one (styled apart by the badge component). */
export const LEGEND_ID = 'legend';
/** Distinct platforms for the gold platform badge (the old fixed list had 6). */
const MANY_PLATFORMS = 6;

/** Stored 0–10 rating thresholds of the rating badges (shown on the user's scale in their copy). */
export const RATING_BADGE_THRESHOLDS = { max: 10, high: 9, low: 4 } as const;

type Def = [id: string, category: AchievementCategory, tier: AchievementTier, current: number, target: number];

/**
 * Derives the badge list from data the app already loads (games list aggregates, stats
 * summary, by-year stats and sagas). Ordered by category, easier first, with the
 * `legend` meta badge last; callers sort unlocked-first for display.
 */
export function computeAchievements({ games: allGames, summary, sagas, years }: AchievementInput): Achievement[] {
  // Games pending review (imported, not confirmed yet) are not in the library.
  const games = allGames.filter((g) => g.reviewStatus !== 'PENDING_REVIEW');
  const played = games.filter(isPlayed);
  const platinums = summary?.totalPlatinums ?? games.filter((g) => g.hasPlatinum).length;
  const fullCompletions = summary?.totalFullCompletions ?? games.filter((g) => g.hasFullCompletion).length;
  const runs = summary?.totalExperiences ?? games.reduce((n, g) => n + (g.experienceCount ?? 0), 0);
  const gameCount = summary?.totalGames ?? games.length;
  const completed = summary?.completedCount ?? games.filter((g) => g.lastExperienceStatus === 'COMPLETADO').length;
  const replays = summary?.replayCount ?? games.reduce((n, g) => n + Math.max(0, (g.experienceCount ?? 0) - 1), 0);
  const inProgress = summary?.inProgressCount ?? games.filter((g) => g.lastExperienceStatus === 'EN_CURSO').length;
  const gameHours = games.reduce((n, g) => n + (g.totalHours ?? 0), 0);
  const totalHours = summary ? summary.totalSingleplayerHours + summary.totalOnlineHours : gameHours;
  const onlineHours = summary
    ? summary.totalOnlineHours
    : games.filter((g) => g.category === 'ONLINE').reduce((n, g) => n + (g.totalHours ?? 0), 0);
  const maxGameHours = Math.max(0, ...games.map((g) => g.totalHours ?? 0));
  const ratings = games.map((g) => g.bestRating).filter((r): r is number => r != null);
  const platforms = new Set(games.flatMap((g) => (g.platformRefs ?? []).map((p) => p.id))).size;
  const activeYears = (years ?? []).filter((y) => y.experienceCount > 0).map((y) => y.year);
  const playedCategories = new Set(played.map((g) => g.category).filter((c) => c != null));
  const playedOnline = played.some(hasOnlineSide) ? 1 : 0;
  const perfectGame = games.some((g) => g.hasPlatinum && g.hasFullCompletion) ? 1 : 0;

  const defs: Def[] = [
    ['collector25', 'collection', 'bronze', gameCount, 25],
    ['collector50', 'collection', 'silver', gameCount, 50],
    ['collector100', 'collection', 'gold', gameCount, 100],

    ['runs10', 'runs', 'bronze', runs, 10],
    ['runs50', 'runs', 'silver', runs, 50],
    ['runs100', 'runs', 'gold', runs, 100],
    ['runs250', 'runs', 'gold', runs, 250],
    ['completed10', 'runs', 'bronze', completed, 10],
    ['completed25', 'runs', 'silver', completed, 25],
    ['completed100', 'runs', 'gold', completed, 100],
    ['firstReplay', 'runs', 'bronze', replays, 1],
    ['replays5', 'runs', 'silver', replays, 5],
    ['replays10', 'runs', 'gold', replays, 10],

    ['hours100', 'hours', 'bronze', totalHours, 100],
    ['hours500', 'hours', 'silver', totalHours, 500],
    ['hours1000', 'hours', 'gold', totalHours, 1000],
    ['hours2500', 'hours', 'gold', totalHours, 2500],
    ['marathon50', 'hours', 'bronze', maxGameHours, 50],
    ['marathon', 'hours', 'silver', maxGameHours, 100],
    ['marathon250', 'hours', 'gold', maxGameHours, 250],

    ['critic', 'ratings', 'silver', ratings.length, 20],
    ['perfectTen', 'ratings', 'silver', ratings.some((r) => r >= RATING_BADGE_THRESHOLDS.max) ? 1 : 0, 1],
    ['masterpieces', 'ratings', 'silver', ratings.filter((r) => r >= RATING_BADGE_THRESHOLDS.high).length, 5],
    ['harshCritic', 'ratings', 'bronze', ratings.some((r) => r <= RATING_BADGE_THRESHOLDS.low) ? 1 : 0, 1],

    ['firstPlatinum', 'platinums', 'bronze', platinums, 1],
    ['platinum5', 'platinums', 'silver', platinums, 5],
    ['platinumHunter', 'platinums', 'gold', platinums, 10],
    ['platinum25', 'platinums', 'gold', platinums, 25],

    ['firstFullCompletion', 'fullCompletions', 'bronze', fullCompletions, 1],
    ['fullCompletion5', 'fullCompletions', 'silver', fullCompletions, 5],
    ['fullCompletion10', 'fullCompletions', 'gold', fullCompletions, 10],
    ['fullCompletion25', 'fullCompletions', 'gold', fullCompletions, 25],

    ['sagaComplete', 'sagas', 'bronze', bestSagaProgress(games, sagas), 1],
    ['sagaTrilogy', 'sagas', 'silver', bestSagaCompleted(games, sagas), 3],

    ['platforms', 'platforms', 'bronze', platforms, 3],
    ['allPlatforms', 'platforms', 'gold', platforms, MANY_PLATFORMS],

    ['years3', 'years', 'bronze', activeYears.length, 3],
    ['veteran', 'years', 'silver', activeYears.length, 5],
    ['years10', 'years', 'gold', activeYears.length, 10],
    ['streak3', 'years', 'bronze', longestStreak(activeYears), 3],
    ['streak5', 'years', 'silver', longestStreak(activeYears), 5],

    ['onlineDebut', 'online', 'bronze', playedOnline, 1],
    ['variety', 'online', 'bronze', playedCategories.size, 3],
    ['online100', 'online', 'silver', onlineHours, 100],
    ['online500', 'online', 'gold', onlineHours, 500],

    ['multitasker', 'special', 'bronze', inProgress, 3],
    ['perfectionist', 'special', 'gold', perfectGame, 1],
  ];

  const list = defs.map(([id, category, tier, current, target], index) =>
    achievement(id, category, tier, current, target, TIER_WEIGHT[tier] * 100 + index),
  );
  // Computed after the rest; ranked above every other badge so it always leads the unlocked ones.
  const legend = achievement(
    LEGEND_ID,
    'special',
    'gold',
    list.filter((a) => a.unlocked).length,
    list.length,
    Math.max(...list.map((a) => a.rank)) + 1,
  );
  return [...list, legend];
}

function achievement(
  id: string,
  category: AchievementCategory,
  tier: AchievementTier,
  current: number,
  target: number,
  rank: number,
): Achievement {
  return {
    id,
    category,
    tier,
    current,
    target,
    unlocked: current >= target,
    progress: target > 0 ? Math.min(1, Math.max(0, current / target)) : 0,
    rank,
  };
}

function hasOnlineSide(game: Game): boolean {
  return game.category === 'ONLINE' || game.category === 'HYBRID';
}

/**
 * Has runs, or online playtime: online playtime is not a run (`experienceCount` misses it) but
 * counts in `totalHours`, and a game with an online side and hours but no runs only has that.
 */
function isPlayed(game: Game): boolean {
  return (game.experienceCount ?? 0) > 0 || (hasOnlineSide(game) && (game.totalHours ?? 0) > 0);
}

/** Played games of each saga (only sagas that exist in the list). */
function sagaMembers(games: readonly Game[], sagas: readonly Saga[]): Game[][] {
  return sagas.map((saga) => games.filter((g) => g.sagaId === saga.id));
}

/**
 * 1 when some saga with >= 2 games has every game played; otherwise the best
 * played ratio among sagas with >= 2 games (0 when there are none).
 */
function bestSagaProgress(games: readonly Game[], sagas: readonly Saga[]): number {
  let best = 0;
  for (const members of sagaMembers(games, sagas)) {
    if (members.length < 2) continue;
    const played = members.filter(isPlayed).length;
    best = Math.max(best, played / members.length);
  }
  return best;
}

/** Most games whose last run is completed within a single saga. */
function bestSagaCompleted(games: readonly Game[], sagas: readonly Saga[]): number {
  return Math.max(0, ...sagaMembers(games, sagas).map((m) => m.filter((g) => g.lastExperienceStatus === 'COMPLETADO').length));
}

/** Longest run of consecutive calendar years in the list. */
function longestStreak(years: readonly number[]): number {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  sorted.forEach((y, i) => {
    run = i > 0 && y === sorted[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** Unlocked first (hardest first), then locked by progress desc. */
export function sortAchievements(list: readonly Achievement[]): Achievement[] {
  return [...list].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    if (a.unlocked) return b.rank - a.rank;
    return b.progress - a.progress || a.rank - b.rank;
  });
}

/** The `count` most impressive unlocked badges. */
export function topUnlocked(list: readonly Achievement[], count = 4): Achievement[] {
  return list
    .filter((a) => a.unlocked)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, count);
}

/** Badges grouped by category in display order (empty categories omitted), keeping input order. */
export function groupByCategory(list: readonly Achievement[]): { category: AchievementCategory; items: Achievement[] }[] {
  return ACHIEVEMENT_CATEGORIES.map((category) => ({ category, items: list.filter((a) => a.category === category) })).filter(
    (g) => g.items.length > 0,
  );
}
