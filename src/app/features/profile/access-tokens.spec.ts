import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { AccessToken } from '../../core/models/access-token.model';
import { AccessTokenService } from '../../core/services/access-token.service';
import { DemoModeService } from '../../core/services/demo-mode.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AccessTokens } from './access-tokens';

const TOKEN: AccessToken = {
  id: 1,
  name: 'Laptop',
  prefix: 'pytra_pat_ab',
  createdAt: '2026-10-01T10:00:00',
  lastUsedAt: null,
};
const PLAINTEXT = 'pytra_pat_' + 'x'.repeat(43);

describe('AccessTokens', () => {
  function setup(options: { tokens?: AccessToken[]; demo?: boolean } = {}) {
    const service = {
      list: vi.fn(() => of(options.tokens ?? [TOKEN])),
      create: vi.fn((name: string) =>
        of({ id: 2, name, token: PLAINTEXT, createdAt: '2026-10-24T10:00:00' }),
      ),
      revoke: vi.fn(() => of(undefined)),
    };
    const toast = { success: vi.fn(), error: vi.fn() };
    const blockWrite = vi.fn(() => options.demo ?? false);
    TestBed.configureTestingModule({
      imports: [AccessTokens],
      providers: [
        provideTranslateService(),
        { provide: AccessTokenService, useValue: service },
        { provide: ToastService, useValue: toast },
        {
          provide: DemoModeService,
          useValue: { isDemo: signal(options.demo ?? false), blockWrite },
        },
      ],
    });
    const fixture = TestBed.createComponent(AccessTokens);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(selector: string) => el.querySelector<T>(selector);
    return { fixture, el, q, service, toast, blockWrite };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('lists tokens by name and prefix, never the token itself', () => {
    const { el } = setup();

    const list = el.querySelector('[data-token-list]')!;
    expect(list.textContent).toContain('Laptop');
    expect(list.textContent).toContain('pytra_pat_ab');
    expect(list.textContent).toContain('profile.tokens.neverUsed');
  });

  it('shows the empty state', () => {
    const { q } = setup({ tokens: [] });

    expect(q('[data-token-empty]')).not.toBeNull();
  });

  it('creates a token and shows its plaintext once, with a copy button', async () => {
    const { fixture, q, service, toast } = setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    q<HTMLButtonElement>('[data-token-new]')!.click();
    fixture.detectChanges();
    const input = q<HTMLInputElement>('[data-token-name]')!;
    expect(input.value).toBe('Obsidian');
    input.value = '  Desktop vault ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-token-create]')!.click();
    fixture.detectChanges();

    expect(service.create).toHaveBeenCalledWith('Desktop vault');
    expect(q<HTMLInputElement>('[data-token-value]')!.value).toBe(PLAINTEXT);
    expect(q('[data-token-list]')!.textContent).toContain('Desktop vault');

    q<HTMLButtonElement>('[data-token-copy]')!.click();
    await fixture.whenStable();
    expect(writeText).toHaveBeenCalledWith(PLAINTEXT);
    expect(toast.success).toHaveBeenCalled();

    // Dismissed: the plaintext is gone for good.
    q<HTMLButtonElement>('[data-token-done]')!.click();
    fixture.detectChanges();
    expect(q('[data-token-created]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain(PLAINTEXT);
  });

  it('reports the token limit from the API', () => {
    const { fixture, q, service, toast } = setup();
    service.create.mockReturnValueOnce(
      throwError(() => ({ status: 409, error: { message: 'ACCESS_TOKEN_LIMIT' } })),
    );

    q<HTMLButtonElement>('[data-token-new]')!.click();
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-token-create]')!.click();
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('profile.tokens.errors.limit');
    expect(q('[data-token-created]')).toBeNull();
  });

  it('disables creating at the limit of five tokens', () => {
    const tokens = [1, 2, 3, 4, 5].map((id) => ({ ...TOKEN, id }));
    const { q } = setup({ tokens });

    expect(q<HTMLButtonElement>('[data-token-new]')!.disabled).toBe(true);
  });

  it('revokes a token only after confirmation', () => {
    const { fixture, q, service, toast } = setup();
    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    q<HTMLButtonElement>('[data-token-revoke]')!.click();
    expect(service.revoke).not.toHaveBeenCalled();

    q<HTMLButtonElement>('[data-token-revoke]')!.click();
    fixture.detectChanges();
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(service.revoke).toHaveBeenCalledWith(1);
    expect(toast.success).toHaveBeenCalled();
    expect(q('[data-token-list]')).toBeNull();
    expect(q('[data-token-empty]')).not.toBeNull();
  });

  it('demo sessions stop at the read-only notice', () => {
    const { fixture, q, service, blockWrite } = setup({ demo: true });

    q<HTMLButtonElement>('[data-token-new]')!.click();
    fixture.detectChanges();

    expect(blockWrite).toHaveBeenCalled();
    expect(q('[data-token-name]')).toBeNull();
    expect(service.create).not.toHaveBeenCalled();
  });
});
