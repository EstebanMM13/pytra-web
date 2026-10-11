import type { InterpolationParameters, TranslateService } from '@ngx-translate/core';

const DEFAULT_LANG = 'es';
const rulesByLang = new Map<string, Intl.PluralRules>();

function pluralRules(lang: string): Intl.PluralRules {
  let rules = rulesByLang.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    rulesByLang.set(lang, rules);
  }
  return rules;
}

/**
 * Plural-aware translation key. For `key` and the CLDR category of `count` in `lang`
 * ("one" for 1 in es/en, "other" otherwise), returns the sibling `key_<category>` when it
 * exists (`has`), else `key` itself, which acts as the default ("other") form.
 * Without a count the key is returned unchanged.
 */
export function pluralKey(
  key: string,
  count: number | null | undefined,
  lang: string | null | undefined,
  has: (key: string) => boolean,
): string {
  if (count === null || count === undefined || !Number.isFinite(count)) {
    return key;
  }
  const candidate = `${key}_${pluralRules(lang || DEFAULT_LANG).select(count)}`;
  return has(candidate) ? candidate : key;
}

/** Whether a dotted key ("a.b.c") resolves to a value in a translation object. */
export function hasTranslationKey(translations: unknown, key: string): boolean {
  let node: unknown = translations;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) {
      return false;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return node !== undefined && node !== null && typeof node !== 'object';
}

/** `pluralKey` resolved against the translations currently loaded in `translate`. */
export function resolvePluralKey(translate: TranslateService, key: string, count: number | null | undefined): string {
  const lang = translate.getCurrentLang() ?? translate.getFallbackLang() ?? DEFAULT_LANG;
  return pluralKey(key, count, lang, (candidate) => hasTranslationKey(translate.getTranslations(lang), candidate));
}

/** Imperative counterpart of the `translatePlural` pipe: picks the plural key and passes `count` as a param. */
export function translatePlural(
  translate: TranslateService,
  key: string,
  count: number,
  params?: InterpolationParameters,
): string {
  return translate.instant(resolvePluralKey(translate, key, count), { ...params, count }) as string;
}
