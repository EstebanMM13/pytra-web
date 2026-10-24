/** A personal access token as listed on the profile (the token itself is never returned again). */
export interface AccessToken {
  id: number;
  name: string;
  /** First characters of the token, to tell tokens apart. */
  prefix: string;
  /** ISO local date-time. */
  createdAt: string;
  /** ISO local date-time; null until the token is first used. */
  lastUsedAt: string | null;
}

/** POST /users/me/tokens answer: the only response that carries the plaintext token. */
export interface CreatedAccessToken {
  id: number;
  name: string;
  token: string;
  createdAt: string;
}
