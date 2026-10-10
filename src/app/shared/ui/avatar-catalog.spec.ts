import { AVATAR_CATEGORIES, AVATAR_KEYS, avatarSrc, findAvatar } from './avatar-catalog';

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
    ]);
    expect(new Set(AVATAR_KEYS).size).toBe(48);
  });

  it('groups the keys into the pack categories, eight each', () => {
    expect(AVATAR_CATEGORIES.map((c) => c.id)).toEqual([
      'hardware', 'objetos', 'abstracto', 'animales', 'pixel', 'generos',
    ]);
    expect(AVATAR_CATEGORIES.every((c) => c.keys.length === 8)).toBe(true);
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
