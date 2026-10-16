export interface CurrentUser {
  username: string;
  usernameDisplay: string;
  email: string;
  hasPassword: boolean;
  googleLinked: boolean;
  /** ISO timestamp of the account creation. */
  createdAt: string | null;
  /** Preset avatar key (see shared/ui/avatar.ts), null when none is picked. */
  avatar: string | null;
  /** Exclusive avatar keys this account may pick (API-owned, by user id); absent or empty for almost everyone. */
  exclusiveAvatars?: string[];
}

/** PATCH /users/me body: only the fields present are changed; `avatar: null` clears it. */
export interface UpdateProfileRequest {
  username?: string;
  avatar?: string | null;
}

export type ExportFormat = 'csv' | 'markdown';

/** DELETE /users/me body: the username typed as confirmation, plus the password when the account has one. */
export interface DeleteAccountRequest {
  confirm: string;
  password?: string;
}
