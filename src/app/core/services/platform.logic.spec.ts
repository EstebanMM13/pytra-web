import { Platform } from '../models/platform.model';
import {
  distinctPlatformRefs,
  findPlatformByKey,
  groupPlatformsByFamily,
  isValidPlatformName,
  normalizePlatformName,
  platformNameKey,
  sortPlatforms,
} from './platform.logic';

const platform = (id: number, name: string, partial: Partial<Platform> = {}): Platform => ({
  id,
  name,
  color: '#8A857C',
  family: 'OTHER',
  legacyCode: null,
  sortOrder: 1000,
  ...partial,
});

const PC = platform(1, 'PC', { family: 'PC', legacyCode: 'PC', sortOrder: 10 });
const PS5 = platform(2, 'PS5', { family: 'PLAYSTATION', legacyCode: 'PS5', sortOrder: 20 });
const SWITCH = platform(14, 'Switch', { family: 'NINTENDO', legacyCode: 'SWITCH', sortOrder: 210 });
const DS = platform(20, 'DS', { family: 'NINTENDO', sortOrder: 270 });
const ANBERNIC = platform(30, 'Anbernic', { family: null, color: null });

describe('platform.logic', () => {
  it('sorts by sortOrder, then name, then id', () => {
    const zeta = platform(40, 'Zeta');
    expect(sortPlatforms([zeta, DS, ANBERNIC, PC, SWITCH, PS5]).map((p) => p.id)).toEqual([1, 2, 14, 20, 30, 40]);
  });

  it('groups by family in a fixed order, null family as OTHER, skipping empty families', () => {
    const groups = groupPlatformsByFamily([PC, PS5, SWITCH, DS, ANBERNIC]);
    expect(groups.map((g) => g.family)).toEqual(['PC', 'PLAYSTATION', 'NINTENDO', 'OTHER']);
    expect(groups[2].platforms.map((p) => p.name)).toEqual(['Switch', 'DS']);
    expect(groups[3].platforms).toEqual([ANBERNIC]);
  });

  it('finds a platform by id, legacy code or name', () => {
    const list = [PC, PS5, SWITCH, DS];
    expect(findPlatformByKey(list, '20')).toBe(DS);
    expect(findPlatformByKey(list, 14)).toBe(SWITCH);
    expect(findPlatformByKey(list, 'SWITCH')).toBe(SWITCH);
    expect(findPlatformByKey(list, 'ps5')).toBe(PS5);
    expect(findPlatformByKey(list, 'ds')).toBe(DS);
    expect(findPlatformByKey(list, '999')).toBeNull();
    expect(findPlatformByKey(list, 'NES')).toBeNull();
    expect(findPlatformByKey(list, '')).toBeNull();
    expect(findPlatformByKey(list, null)).toBeNull();
  });

  it('normalizes and validates names like the API (1–40 characters)', () => {
    expect(normalizePlatformName('  PS   Vita ')).toBe('PS Vita');
    expect(isValidPlatformName('Anbernic')).toBe(true);
    expect(isValidPlatformName('   ')).toBe(false);
    expect(isValidPlatformName('x'.repeat(40))).toBe(true);
    expect(isValidPlatformName('x'.repeat(41))).toBe(false);
  });

  it('translates only the seeded Spanish names', () => {
    expect(platformNameKey('Móvil')).toBe('platform.MOBILE');
    expect(platformNameKey('Retro / Emulador')).toBe('platform.RETRO');
    expect(platformNameKey('PS5')).toBeNull();
    expect(platformNameKey(null)).toBeNull();
  });

  it('keeps the first occurrence of each platform ref', () => {
    const refs = [
      { id: 1, name: 'PC', color: null },
      { id: 2, name: 'PS5', color: null },
      { id: 1, name: 'PC', color: null },
    ];
    expect(distinctPlatformRefs(refs).map((r) => r.id)).toEqual([1, 2]);
  });
});
