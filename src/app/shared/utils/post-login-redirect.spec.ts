import {
  POST_LOGIN_REDIRECT_TTL_MS,
  RESUME_DELETE_ACCOUNT,
  clearPostLoginRedirect,
  consumePostLoginRedirect,
  rememberPostLoginRedirect,
} from './post-login-redirect';

describe('post-login redirect', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns a remembered whitelisted path once', () => {
    rememberPostLoginRedirect(RESUME_DELETE_ACCOUNT, 1_000);
    expect(consumePostLoginRedirect(2_000)).toBe(RESUME_DELETE_ACCOUNT);
    expect(consumePostLoginRedirect(2_000)).toBeNull();
  });

  it('expires after five minutes', () => {
    rememberPostLoginRedirect(RESUME_DELETE_ACCOUNT, 0);
    expect(consumePostLoginRedirect(POST_LOGIN_REDIRECT_TTL_MS + 1)).toBeNull();
    // Consuming clears it even when expired.
    expect(sessionStorage.getItem('pytra_post_login')).toBeNull();
  });

  it('can be cleared explicitly', () => {
    rememberPostLoginRedirect(RESUME_DELETE_ACCOUNT);
    clearPostLoginRedirect();
    expect(consumePostLoginRedirect()).toBeNull();
  });

  it('ignores paths outside the whitelist and malformed values', () => {
    rememberPostLoginRedirect('https://evil.example');
    expect(consumePostLoginRedirect()).toBeNull();
    sessionStorage.setItem('pytra_post_login', JSON.stringify({ path: '/somewhere', ts: Date.now() }));
    expect(consumePostLoginRedirect()).toBeNull();
    sessionStorage.setItem('pytra_post_login', RESUME_DELETE_ACCOUNT);
    expect(consumePostLoginRedirect()).toBeNull();
    sessionStorage.setItem('pytra_post_login', JSON.stringify({ path: RESUME_DELETE_ACCOUNT }));
    expect(consumePostLoginRedirect()).toBeNull();
  });
});
