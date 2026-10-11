import { Pipe, PipeTransform, inject } from '@angular/core';
import { InterpolationParameters, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { resolvePluralKey } from '../utils/plural';

/**
 * `translate` with singular/plural forms: `{{ 'common.games' | translatePlural: n }}` renders
 * `common.games_one` when n is 1 (and that key exists), else `common.games`, with `count: n`
 * merged into the params. Impure and delegating to TranslatePipe, so it follows language changes.
 */
@Pipe({ name: 'translatePlural', pure: false })
export class TranslatePluralPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);
  private readonly inner = new TranslatePipe();

  transform(key: string, count: number | null | undefined, params?: InterpolationParameters): string {
    const resolved = resolvePluralKey(this.translate, key, count);
    const merged = count === null || count === undefined ? params : { ...params, count };
    return this.inner.transform(resolved, merged) as string;
  }
}
