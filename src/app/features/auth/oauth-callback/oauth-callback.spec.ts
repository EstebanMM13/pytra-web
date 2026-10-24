import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { OauthCallback } from './oauth-callback';

describe('OauthCallback (Steam link flow)', () => {
  function setup(params: Record<string, string>, authenticated = false, exchangeFails = false) {
    const exchangeCode = vi.fn(() => (exchangeFails ? throwError(() => new Error('consumed')) : of(undefined)));
    TestBed.configureTestingModule({
      imports: [OauthCallback],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: AuthService, useValue: { exchangeCode, isAuthenticated: () => authenticated } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.createComponent(OauthCallback);
    return { navigate, exchangeCode };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lands on /sync with linked=1 after a successful link (next=steam)', () => {
    const { navigate, exchangeCode } = setup({ code: 'abc', next: 'steam' });
    expect(exchangeCode).toHaveBeenCalledWith({ code: 'abc' });
    expect(navigate).toHaveBeenCalledWith(['/sync'], { queryParams: { linked: '1' }, replaceUrl: true });
  });

  it('shows link errors on /sync', () => {
    const { navigate, exchangeCode } = setup({ error: 'steam_already_linked', next: 'steam' });
    expect(exchangeCode).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/sync'], {
      queryParams: { linkError: 'steam_already_linked' },
      replaceUrl: true,
    });
  });

  it('exchanges a code only once when the callback is reached twice', () => {
    const first = setup({ code: 'dup-1' });
    expect(first.exchangeCode).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();

    const second = setup({ code: 'dup-1' });
    expect(second.exchangeCode).not.toHaveBeenCalled();
    expect(second.navigate).not.toHaveBeenCalled();
  });

  it('lands on the dashboard instead of failing when the exchange is rejected but a session exists', () => {
    const { navigate } = setup({ code: 'dup-2' }, true, true);
    expect(navigate).toHaveBeenCalledWith(['/dashboard'], { queryParams: {}, replaceUrl: true });
  });

  it('still shows the error when the exchange fails without a session', () => {
    const { navigate } = setup({ code: 'bad-1' }, false, true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
