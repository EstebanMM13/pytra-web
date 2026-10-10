/**
 * Preset profile avatars: the illustrated SVG pack served from /avatars/<key>.svg (public/avatars).
 * Mirrors the pack's index.json (categories -> keys, in picker order). Keys must match the API allowlist
 * (pytra-api AvatarPolicy.KEYS); the list is duplicated across repos on purpose and pinned by tests on both
 * sides (avatar-catalog.spec.ts here, AvatarPolicyTest there), so it cannot drift silently.
 */
export const AVATAR_CATEGORIES = [
  {
    id: 'hardware',
    keys: ['mando', 'portatil', 'joystick', 'cartucho', 'auriculares', 'recreativa', 'raton', 'disco'],
  },
  {
    id: 'objetos',
    keys: ['espada', 'pocion', 'corazon', 'moneda', 'llave', 'cofre', 'escudo', 'bomba'],
  },
  {
    id: 'abstracto',
    keys: ['barras', 'play', 'pixeles', 'anillo', 'triangulos', 'ondas', 'rombo', 'orbita'],
  },
  {
    id: 'animales',
    keys: ['zorro', 'buho', 'gato', 'rana', 'oso', 'pulpo', 'pinguino', 'conejo'],
  },
  {
    id: 'pixel',
    keys: ['heroe', 'invasor', 'fantasmapx', 'setapx', 'corazonpx', 'espadapx', 'slimepx', 'calavera'],
  },
  {
    id: 'generos',
    keys: ['rpg', 'shooter', 'carreras', 'puzzle', 'terror', 'plataformas', 'estrategia', 'deportes'],
  },
] as const satisfies readonly { id: string; keys: readonly string[] }[];

export type AvatarCategory = (typeof AVATAR_CATEGORIES)[number]['id'];
export type AvatarKey = (typeof AVATAR_CATEGORIES)[number]['keys'][number];

/** Every preset key, in picker order. */
export const AVATAR_KEYS: readonly AvatarKey[] = AVATAR_CATEGORIES.flatMap((c) => c.keys);

const KNOWN_KEYS: ReadonlySet<string> = new Set(AVATAR_KEYS);

/** The stored key when it is a known preset; null when empty or unknown (the initial is shown instead). */
export function findAvatar(key: string | null | undefined): AvatarKey | null {
  return key && KNOWN_KEYS.has(key) ? (key as AvatarKey) : null;
}

/** Public URL of a preset's SVG (root-relative so it works on the web and inside the Capacitor shell). */
export function avatarSrc(key: AvatarKey): string {
  return `/avatars/${key}.svg`;
}
