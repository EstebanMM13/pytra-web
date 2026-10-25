import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { OauthCallback } from './oauth-callback';

describe('OauthCallback (Steam link flow)', () => {
  function setup(
    params: Record<string, string>,
    authenticated = false,
    exchangeFails = false,
    response?: Observable<undefined>,
  ) {
    const exchangeCode = vi.fn(
      () => response ?? (exchangeFails ? throwError(() => new Error('consumed')) : of(undefined)),
    );
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
    const component = TestBed.createComponent(OauthCallback).componentInstance;
    return { navigate, exchangeCode, component };
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
    // The second visit replays the first result instead of staying on "processing".
    expect(second.navigate).toHaveBeenCalledWith(['/dashboard'], { queryParams: {}, replaceUrl: true });
  });

  it('lands a duplicate visit once the first exchange, still in flight, succeeds', () => {
    const response = new Subject<undefined>();
    const first = setup({ code: 'dup-3' }, false, false, response);
    TestBed.resetTestingModule();

    const second = setup({ code: 'dup-3' });
    expect(second.navigate).not.toHaveBeenCalled();
    response.next(undefined);
    response.complete();
    expect(first.exchangeCode).toHaveBeenCalledTimes(1);
    expect(second.exchangeCode).not.toHaveBeenCalled();
    expect(second.navigate).toHaveBeenCalledWith(['/dashboard'], { queryParams: {}, replaceUrl: true });
  });

  it('shows the error on a duplicate visit when the first exchange failed', () => {
    setup({ code: 'dup-4' }, false, true);
    TestBed.resetTestingModule();

    const second = setup({ code: 'dup-4' });
    expect(second.exchangeCode).not.toHaveBeenCalled();
    expect(second.navigate).not.toHaveBeenCalled();
    expect(second.component.failed()).toBe(true);
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
