import { AVATAR_CATEGORIES, AVATAR_KEYS, avatarSrc, findAvatar } from './avatar-catalog';

/** "Tipos de jugador" pack (avatares-perfiles-v2); the "tipo" prefix keeps "tipoterror" apart from "terror". */
const PLAYER_TYPES = [
  'tipoexplorador', 'tipocazatrofeos', 'tiporoguelitero', 'tipocuentacuentos',
  'tipospeedrunner', 'tipocompetitivo', 'tiposofa', 'tipobacklog',
  'tiponocturno', 'tiporetro', 'tipomelomano', 'tiporejugador',
  'tipomasoquista', 'tipoestratega', 'tipoconstructor', 'tipocozy',
  'tipostreamer', 'tipohacker', 'tipopiloto', 'tipoterror',
  'tipomovil', 'tipocapitan', 'tipocoleccionista', 'tipofotografo',
];

describe('avatar catalog', () => {
  // Pinned on purpose: pytra-api AvatarPolicyTest asserts this same list against AvatarPolicy.KEYS.
  // The repos cannot share a file, so changing one side must fail a test until the other follows.
  it('matches the API allowlist (AvatarPolicy.KEYS) exactly, in picker order', () => {
    expect(AVATAR_KEYS).toEqual([
      'mando', 'portatil', 'joystick', 'cartucho', 'auriculares', 'recreativa', 'raton', 'disco',
      'espada', 'pocion', 'corazon', 'moneda', 'llave', 'cofre', 'escudo', 'bomba',
      'barras', 'play', 'pixeles', 'anillo', 'triangulos', 'ondas', 'rombo', 'orbita',
      'zorro', 'buho', 'gato', 'rana', 'oso', 'pulpo', 'pinguino', 'conejo',
      'heroe', 'invasor', 'fantasmapx', 'setapx', 'corazonpx', 'espadapx', 'slimepx', 'calavera',
      'rpg', 'shooter', 'carreras', 'puzzle', 'terror', 'plataformas', 'estrategia', 'deportes',
      ...PLAYER_TYPES,
    ]);
    expect(new Set(AVATAR_KEYS).size).toBe(72);
  });

  it('groups the keys into the pack categories: eight each, then the 24 player types', () => {
    expect(AVATAR_CATEGORIES.map((c) => c.id)).toEqual([
      'hardware', 'objetos', 'abstracto', 'animales', 'pixel', 'generos', 'tipos',
    ]);
    expect(AVATAR_CATEGORIES.slice(0, 6).every((c) => c.keys.length === 8)).toBe(true);
    const types = AVATAR_CATEGORIES[6];
    expect(types.keys).toEqual(PLAYER_TYPES);
    expect(types.described).toBe(true);
  });

  it('uses keys the API accepts (lowercase ASCII letters, fits users.avatar VARCHAR(32))', () => {
    // Same rule as pytra-api AvatarPolicyTest.everyKeyFitsTheColumnAndIsLowercaseAscii.
    for (const key of AVATAR_KEYS) {
      expect(key, key).toMatch(/^[a-z]+$/);
      expect(key.length, key).toBeLessThanOrEqual(32);
    }
  });

  it('has a matching SVG in public/avatars for every key', async () => {
    // Specs run in Node (cwd = project root); a non-literal specifier keeps node:fs out of the typings.
    const fsModule = 'node:fs';
    const { existsSync } = (await import(fsModule)) as { existsSync(path: string): boolean };
    const missing = AVATAR_KEYS.filter((key) => !existsSync(`public${avatarSrc(key)}`));
    expect(missing).toEqual([]);
  });

  it('finds presets by exact key only', () => {
    expect(findAvatar('zorro')).toBe('zorro');
    expect(findAvatar('ZORRO')).toBeNull();
    expect(findAvatar('ghost')).toBeNull();
    expect(findAvatar('')).toBeNull();
    expect(findAvatar(undefined)).toBeNull();
  });

  it('serves each preset from /avatars', () => {
    expect(avatarSrc('buho')).toBe('/avatars/buho.svg');
  });
});
