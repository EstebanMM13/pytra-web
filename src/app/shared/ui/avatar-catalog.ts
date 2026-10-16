/**
 * Preset profile avatars: the illustrated SVG pack served from /avatars/<key>.svg (public/avatars), plus
 * single-owner exclusive presets (EXCLUSIVE_AVATARS) that may use another file extension.
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
  {
    // Player types: each preset also has a one-line description (profile.avatar.descriptions.<key>).
    id: 'tipos',
    described: true,
    keys: [
      'tipoexplorador', 'tipocazatrofeos', 'tiporoguelitero', 'tipocuentacuentos',
      'tipospeedrunner', 'tipocompetitivo', 'tiposofa', 'tipobacklog',
      'tiponocturno', 'tiporetro', 'tipomelomano', 'tiporejugador',
      'tipomasoquista', 'tipoestratega', 'tipoconstructor', 'tipocozy',
      'tipostreamer', 'tipohacker', 'tipopiloto', 'tipoterror',
      'tipomovil', 'tipocapitan', 'tipocoleccionista', 'tipofotografo',
    ],
  },
] as const satisfies readonly { id: string; described?: boolean; keys: readonly string[] }[];

export type AvatarCategory = (typeof AVATAR_CATEGORIES)[number]['id'];
export type SharedAvatarKey = (typeof AVATAR_CATEGORIES)[number]['keys'][number];

/**
 * Single-owner presets. Not part of AVATAR_KEYS: the API keeps them out of AvatarPolicy.KEYS, decides who owns
 * them (ExclusiveAvatars, by user id) and lists the signed-in user's keys in CurrentUser.exclusiveAvatars; the
 * picker offers only those. Any account still renders them if stored. `ext` overrides the default SVG extension.
 */
export const EXCLUSIVE_AVATARS = [
  { key: 'estebanexplorador', ext: 'webp' },
] as const satisfies readonly { key: string; ext?: AvatarFileExt }[];

export type AvatarFileExt = 'svg' | 'webp';
export type ExclusiveAvatarKey = (typeof EXCLUSIVE_AVATARS)[number]['key'];
export type AvatarKey = SharedAvatarKey | ExclusiveAvatarKey;

/** Every shared preset key, in picker order (exactly the API's AvatarPolicy.KEYS). */
export const AVATAR_KEYS: readonly SharedAvatarKey[] = AVATAR_CATEGORIES.flatMap((c) => c.keys);

const KNOWN_KEYS: ReadonlySet<string> = new Set<string>([
  ...AVATAR_KEYS,
  ...EXCLUSIVE_AVATARS.map((a) => a.key),
]);

const FILE_EXT: ReadonlyMap<string, AvatarFileExt> = new Map(
  EXCLUSIVE_AVATARS.map((a) => [a.key, a.ext] as const),
);

/** The stored key when it is a known preset (shared or exclusive); null when empty or unknown (initial shown). */
export function findAvatar(key: string | null | undefined): AvatarKey | null {
  return key && KNOWN_KEYS.has(key) ? (key as AvatarKey) : null;
}

/**
 * The exclusive presets among the keys the API granted (CurrentUser.exclusiveAvatars), in catalog order.
 * Keys this client has no image for are dropped.
 */
export function grantedExclusiveAvatars(granted: readonly string[] | null | undefined): ExclusiveAvatarKey[] {
  const keys = new Set(granted ?? []);
  return EXCLUSIVE_AVATARS.filter((a) => keys.has(a.key)).map((a) => a.key);
}

/** Public URL of a preset's image (root-relative so it works on the web and inside the Capacitor shell). */
export function avatarSrc(key: AvatarKey): string {
  return `/avatars/${key}.${FILE_EXT.get(key) ?? 'svg'}`;
}
