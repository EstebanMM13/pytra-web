import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { OauthCallback } from './oauth-callback';

describe('OauthCallback (Steam link flow)', () => {
  function setup(params: Record<string, string>) {
    const exchangeCode = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      imports: [OauthCallback],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: AuthService, useValue: { exchangeCode } },
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
});
