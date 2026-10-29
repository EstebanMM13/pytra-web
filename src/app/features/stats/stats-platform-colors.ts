import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { Platform } from '../../core/models/platform.model';
import { PlatformService } from '../../core/services/platform.service';
import { PlatformColorOf, platformColor, platformShades } from './stats.logic';

/**
 * Platform colours of the stats sections: one shade per catalog platform (so PS4 and PS5 are told
 * apart), the catalog colour until the catalog loads or when it fails. Created in an injection
 * context; read the signal inside a `computed` so the rows recolour once the catalog arrives.
 */
export function statsPlatformColors(): Signal<PlatformColorOf> {
  const platforms = inject(PlatformService);
  const catalog = toSignal(platforms.load().pipe(catchError(() => of([] as Platform[]))), {
    initialValue: platforms.platforms() ?? [],
  });
  return computed(() => {
    const shades = platformShades(catalog());
    return (id: number, color: string | null | undefined) => shades.get(id) ?? platformColor(color);
  });
}
