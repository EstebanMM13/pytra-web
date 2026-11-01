/** An achievement the API stores as unlocked (`/achievements`): the web's id and its first unlock date. */
export interface UnlockedAchievement {
  id: string;
  /** ISO local date-time of the first time it was recorded. */
  unlockedAt: string;
}
