import { Pipe, PipeTransform } from '@angular/core';

/** Words that stay upper case after formatting. Words containing a digit (2D, 4X) also do. */
const ACRONYMS = new Set([
  'RPG', 'JRPG', 'ARPG', 'CRPG', 'MMO', 'MMORPG', 'FPS', 'TPS', 'RTS', 'MOBA', 'VR', 'AR', 'CCG', 'TCG',
]);

/**
 * Formats a genre name for display. The API stores names upper-cased (it is the dedup key),
 * so "MUNDO ABIERTO" -> "Mundo abierto" and "ACTION RPG" -> "Action RPG".
 */
export function formatGenreName(name: string): string {
  const sentence = name.trim().toLocaleLowerCase('es');
  const words = sentence.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const upper = word.toLocaleUpperCase('es');
    return ACRONYMS.has(upper) || /\d/.test(word) ? upper : word;
  });
  return words.charAt(0).toLocaleUpperCase('es') + words.slice(1);
}

@Pipe({ name: 'genreName' })
export class GenreNamePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ? formatGenreName(value) : '';
  }
}
