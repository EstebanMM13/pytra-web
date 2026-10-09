export interface CurrentUser {
  username: string;
  usernameDisplay: string;
  email: string;
  hasPassword: boolean;
  googleLinked: boolean;
}

export interface UpdateUsernameRequest {
  username: string;
}
