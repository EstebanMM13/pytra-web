import { Game } from '../../core/models/game.model';
import { Saga } from '../../core/models/saga.model';
import { StatsSummary, YearStat } from '../../core/models/stats.model';

/** Icon keys mapped to lucide icons by the badge component (keeps this helper framework-free). */
export type AchievementIcon =
  | 'trophy'
  | 'crown'
  | 'timer'
  | 'play'
  | 'flame'
  | 'medal'
  | 'library'
  | 'archive'
  | 'gem'
  | 'layers'
  | 'star'
  | 'monitor'
  | 'calendar'
  | 'check'
  | 'repeat'
  | 'hourglass'
  | 'clock'
  | 'mountain'
  | 'sparkles'
  | 'heart'
  | 'thumbsDown'
  | 'award'
  | 'globe'
  | 'zap'
  | 'users'
  | 'wifi'
  | 'shuffle'
  | 'target'
  | 'bookOpen';

export type AchievementCategory =
  | 'collection'
  | 'runs'
  | 'hours'
  | 'ratings'
  | 'platinums'
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
  icon: AchievementIcon;
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
const ALL_PLATFORMS = 6;

type Def = [id: string, category: AchievementCategory, tier: AchievementTier, icon: AchievementIcon, current: number, target: number];

/**
 * Derives the badge list from data the app already loads (games list aggregates, stats
 * summary, by-year stats and sagas). Ordered by category, easier first; callers sort
 * unlocked-first for display.
 */
export function computeAchievements({ games, summary, sagas, years }: AchievementInput): Achievement[] {
  const played = games.filter((g) => (g.experienceCount ?? 0) > 0);
  const platinums = summary?.totalPlatinums ?? games.filter((g) => g.hasPlatinum).length;
  const runs = summary?.totalExperiences ?? games.reduce((n, g) => n + (g.experienceCount ?? 0), 0);
  const gameCount = summary?.totalGames ?? games.length;
  const completed = summary?.completedCount ?? games.filter((g) => g.lastExperienceStatus === 'COMPLETADO').length;
  const replays = summary?.replayCount ?? games.reduce((n, g) => n + Math.max(0, (g.experienceCount ?? 0) - 1), 0);
  const abandoned = summary?.abandonedCount ?? games.filter((g) => g.lastExperienceStatus === 'ABANDONADO').length;
  const inProgress = summary?.inProgressCount ?? games.filter((g) => g.lastExperienceStatus === 'EN_CURSO').length;
  const gameHours = games.reduce((n, g) => n + (g.totalHours ?? 0), 0);
  const totalHours = summary ? summary.totalSingleplayerHours + summary.totalOnlineHours : gameHours;
  const onlineHours = summary
    ? summary.totalOnlineHours
    : games.filter((g) => g.category === 'ONLINE').reduce((n, g) => n + (g.totalHours ?? 0), 0);
  const maxGameHours = Math.max(0, ...games.map((g) => g.totalHours ?? 0));
  const ratings = games.map((g) => g.bestRating).filter((r): r is number => r != null);
  const platforms = new Set(games.flatMap((g) => g.platforms ?? [])).size;
  const activeYears = (years ?? []).filter((y) => y.experienceCount > 0).map((y) => y.year);
  const playedCategories = new Set(played.map((g) => g.category).filter((c) => c != null));
  const playedOnline = played.some((g) => g.category === 'ONLINE' || g.category === 'HYBRID') ? 1 : 0;

  const defs: Def[] = [
    ['collector25', 'collection', 'bronze', 'library', gameCount, 25],
    ['collector50', 'collection', 'silver', 'archive', gameCount, 50],
    ['collector100', 'collection', 'gold', 'gem', gameCount, 100],

    ['runs10', 'runs', 'bronze', 'play', runs, 10],
    ['runs50', 'runs', 'silver', 'flame', runs, 50],
    ['runs100', 'runs', 'gold', 'medal', runs, 100],
    ['completed10', 'runs', 'bronze', 'check', completed, 10],
    ['completed25', 'runs', 'silver', 'check', completed, 25],
    ['completed100', 'runs', 'gold', 'award', completed, 100],
    ['firstReplay', 'runs', 'bronze', 'repeat', replays, 1],
    ['replays5', 'runs', 'silver', 'repeat', replays, 5],

    ['hours100', 'hours', 'bronze', 'clock', totalHours, 100],
    ['hours500', 'hours', 'silver', 'clock', totalHours, 500],
    ['hours1000', 'hours', 'gold', 'hourglass', totalHours, 1000],
    ['hours2500', 'hours', 'gold', 'hourglass', totalHours, 2500],
    ['marathon50', 'hours', 'bronze', 'timer', maxGameHours, 50],
    ['marathon', 'hours', 'silver', 'timer', maxGameHours, 100],
    ['marathon250', 'hours', 'gold', 'mountain', maxGameHours, 250],

    ['critic', 'ratings', 'silver', 'star', ratings.length, 20],
    ['perfectTen', 'ratings', 'silver', 'sparkles', ratings.some((r) => r >= 10) ? 1 : 0, 1],
    ['masterpieces', 'ratings', 'silver', 'heart', ratings.filter((r) => r >= 9).length, 5],
    ['harshCritic', 'ratings', 'bronze', 'thumbsDown', ratings.some((r) => r <= 4) ? 1 : 0, 1],

    ['firstPlatinum', 'platinums', 'bronze', 'trophy', platinums, 1],
    ['platinum5', 'platinums', 'silver', 'trophy', platinums, 5],
    ['platinumHunter', 'platinums', 'gold', 'crown', platinums, 10],
    ['platinum25', 'platinums', 'gold', 'crown', platinums, 25],

    ['sagaComplete', 'sagas', 'bronze', 'layers', bestSagaProgress(games, sagas), 1],
    ['sagaTrilogy', 'sagas', 'silver', 'bookOpen', bestSagaCompleted(games, sagas), 3],

    ['platforms', 'platforms', 'bronze', 'monitor', platforms, 3],
    ['allPlatforms', 'platforms', 'gold', 'globe', platforms, ALL_PLATFORMS],

    ['years3', 'years', 'bronze', 'calendar', activeYears.length, 3],
    ['veteran', 'years', 'silver', 'calendar', activeYears.length, 5],
    ['years10', 'years', 'gold', 'calendar', activeYears.length, 10],
    ['streak3', 'years', 'bronze', 'zap', longestStreak(activeYears), 3],

    ['onlineDebut', 'online', 'bronze', 'wifi', playedOnline, 1],
    ['variety', 'online', 'bronze', 'shuffle', playedCategories.size, 3],
    ['online100', 'online', 'silver', 'users', onlineHours, 100],
    ['online500', 'online', 'gold', 'users', onlineHours, 500],

    ['multitasker', 'special', 'bronze', 'target', inProgress, 3],
    // Ten completed runs and nothing ever abandoned: progress resets while any run is abandoned.
    ['completionist', 'special', 'gold', 'award', abandoned > 0 ? 0 : completed, 10],
  ];

  return defs.map(([id, category, tier, icon, current, target], index) => ({
    id,
    category,
    tier,
    icon,
    current,
    target,
    unlocked: current >= target,
    progress: target > 0 ? Math.min(1, Math.max(0, current / target)) : 0,
    rank: TIER_WEIGHT[tier] * 100 + index,
  }));
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
    const played = members.filter((g) => (g.experienceCount ?? 0) > 0).length;
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
