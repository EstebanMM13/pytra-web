import { Pipe, PipeTransform } from '@angular/core';

const HOURS_FORMAT = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

/** Formats a decimal hour count for display, e.g. 112.916666 -> "112,9 h". */
@Pipe({ name: 'hours' })
export class HoursPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return `${HOURS_FORMAT.format(value ?? 0)} h`;
  }
}
