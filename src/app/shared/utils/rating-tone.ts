/** Text colour class for a 0–10 rating: >=9 green, 7–<9 gold, 6–<7 amber, <6 danger. */
export type RatingToneClass = 'text-rating-high' | 'text-gold' | 'text-rating-mid' | 'text-danger';

export function ratingTone(rating: number | null | undefined): RatingToneClass {
  if (rating === null || rating === undefined || Number.isNaN(rating)) {
    return 'text-gold';
  }
  if (rating >= 9) return 'text-rating-high';
  if (rating >= 7) return 'text-gold';
  if (rating >= 6) return 'text-rating-mid';
  return 'text-danger';
}
