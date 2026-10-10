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
  | 'calendar';

export interface Achievement {
  /** Also the i18n key: `achievements.items.{id}.title|desc`. */
  id: string;
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

const PLATFORM_TARGET = 3;
const MARATHON_HOURS = 100;
const CRITIC_TARGET = 20;
const VETERAN_YEARS = 5;

/**
 * Derives the badge list from data the app already loads. Ordered by definition
 * (easier first); callers sort unlocked-first for display.
 */
export function computeAchievements({ games, summary, sagas, years }: AchievementInput): Achievement[] {
  const platinums = summary?.totalPlatinums ?? games.filter((g) => g.hasPlatinum).length;
  const runs = summary?.totalExperiences ?? games.reduce((n, g) => n + (g.experienceCount ?? 0), 0);
  const gameCount = summary?.totalGames ?? games.length;
  const maxGameHours = Math.max(0, ...games.map((g) => g.totalHours ?? 0));
  const ratedGames = games.filter((g) => g.bestRating != null).length;
  const platforms = new Set(games.flatMap((g) => g.platforms ?? [])).size;
  const activeYears = (years ?? []).filter((y) => y.experienceCount > 0).length;

  const list: [string, AchievementIcon, number, number][] = [
    ['firstPlatinum', 'trophy', platinums, 1],
    ['runs10', 'play', runs, 10],
    ['collector25', 'library', gameCount, 25],
    ['platforms', 'monitor', platforms, PLATFORM_TARGET],
    ['sagaComplete', 'layers', bestSagaProgress(games, sagas), 1],
    ['critic', 'star', ratedGames, CRITIC_TARGET],
    ['runs50', 'flame', runs, 50],
    ['collector50', 'archive', gameCount, 50],
    ['marathon', 'timer', maxGameHours, MARATHON_HOURS],
    ['veteran', 'calendar', activeYears, VETERAN_YEARS],
    ['runs100', 'medal', runs, 100],
    ['collector100', 'gem', gameCount, 100],
    ['platinumHunter', 'crown', platinums, 10],
  ];

  return list.map(([id, icon, current, target], rank) => ({
    id,
    icon,
    current,
    target,
    unlocked: current >= target,
    progress: target > 0 ? Math.min(1, Math.max(0, current / target)) : 0,
    rank,
  }));
}

/**
 * 1 when some saga with >= 2 games has every game played; otherwise the best
 * played ratio among sagas with >= 2 games (0 when there are none).
 */
function bestSagaProgress(games: readonly Game[], sagas: readonly Saga[]): number {
  let best = 0;
  for (const saga of sagas) {
    const members = games.filter((g) => g.sagaId === saga.id);
    if (members.length < 2) continue;
    const played = members.filter((g) => (g.experienceCount ?? 0) > 0).length;
    best = Math.max(best, played / members.length);
  }
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
