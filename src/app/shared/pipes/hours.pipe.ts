import { Pipe, PipeTransform } from '@angular/core';

const HOURS_FORMAT = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
// Large totals drop the decimal so they fit in small cards (3.749 h, not 3748,7 h).
const LARGE_HOURS_FORMAT = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: true });

/** Formats a decimal hour count for display, e.g. 112.916666 -> "112,9 h". */
@Pipe({ name: 'hours' })
export class HoursPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    const hours = value ?? 0;
    return `${(hours >= 1000 ? LARGE_HOURS_FORMAT : HOURS_FORMAT).format(hours)} h`;
  }
}
