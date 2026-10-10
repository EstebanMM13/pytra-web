import { RESUME_DELETE_ACCOUNT, consumePostLoginRedirect, rememberPostLoginRedirect } from './post-login-redirect';

describe('post-login redirect', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns a remembered whitelisted path once', () => {
    rememberPostLoginRedirect(RESUME_DELETE_ACCOUNT);
    expect(consumePostLoginRedirect()).toBe(RESUME_DELETE_ACCOUNT);
    expect(consumePostLoginRedirect()).toBeNull();
  });

  it('ignores paths outside the whitelist', () => {
    rememberPostLoginRedirect('https://evil.example');
    expect(consumePostLoginRedirect()).toBeNull();
    sessionStorage.setItem('pytra_post_login', '/somewhere');
    expect(consumePostLoginRedirect()).toBeNull();
  });
});
