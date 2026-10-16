import {
  AVATAR_CATEGORIES,
  AVATAR_KEYS,
  EXCLUSIVE_AVATARS,
  avatarSrc,
  grantedExclusiveAvatars,
  findAvatar,
} from './avatar-catalog';

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

  describe('exclusive presets', () => {
    it('keeps estebanexplorador out of the shared list, served as WebP', () => {
      // Pinned on purpose: pytra-api AvatarPolicyTest asserts AvatarPolicy.EXCLUSIVE_KEYS is this same set.
      expect(EXCLUSIVE_AVATARS.map((a) => a.key)).toEqual(['estebanexplorador']);
      expect(AVATAR_KEYS).not.toContain('estebanexplorador');
      expect(avatarSrc('estebanexplorador')).toBe('/avatars/estebanexplorador.webp');
    });

    it('uses keys the API accepts', () => {
      for (const { key } of EXCLUSIVE_AVATARS) {
        expect(key, key).toMatch(/^[a-z]+$/);
        expect(key.length, key).toBeLessThanOrEqual(32);
      }
    });

    it('has the image file in public/avatars', async () => {
      const fsModule = 'node:fs';
      const { existsSync } = (await import(fsModule)) as { existsSync(path: string): boolean };
      const missing = EXCLUSIVE_AVATARS.filter(({ key }) => !existsSync(`public${avatarSrc(key)}`));
      expect(missing).toEqual([]);
    });

    it('still renders when stored, whoever the account is', () => {
      expect(findAvatar('estebanexplorador')).toBe('estebanexplorador');
    });

    it('offers only the keys the API granted, ignoring ones without an image here', () => {
      expect(grantedExclusiveAvatars(['estebanexplorador'])).toEqual(['estebanexplorador']);
      expect(grantedExclusiveAvatars(['unknownexclusive', 'estebanexplorador'])).toEqual(['estebanexplorador']);
      expect(grantedExclusiveAvatars(['ESTEBANEXPLORADOR', 'mando'])).toEqual([]);
      expect(grantedExclusiveAvatars([])).toEqual([]);
      expect(grantedExclusiveAvatars(null)).toEqual([]);
      expect(grantedExclusiveAvatars(undefined)).toEqual([]);
    });
  });
});
