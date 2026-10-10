import { Pipe, PipeTransform } from '@angular/core';
import { ratingTone, RatingToneClass } from '../utils/rating-tone';

/** Template form of `ratingTone`: `[class]="r | ratingTone"`. */
@Pipe({ name: 'ratingTone' })
export class RatingTonePipe implements PipeTransform {
  transform(value: number | null | undefined): RatingToneClass {
    return ratingTone(value);
  }
}
