export interface CurrentUser {
  username: string;
  usernameDisplay: string;
  email: string;
  hasPassword: boolean;
  googleLinked: boolean;
  /** ISO timestamp of the account creation. */
  createdAt: string | null;
}

export interface UpdateUsernameRequest {
  username: string;
}

export type ExportFormat = 'csv' | 'markdown';

/** DELETE /users/me body: the username typed as confirmation, plus the password when the account has one. */
export interface DeleteAccountRequest {
  confirm: string;
  password?: string;
}
