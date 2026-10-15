import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { App } from './app';

describe('App', () => {
  // compileComponents resolves the @defer dependencies (toast host, run form) and loads the
  // unminified @lucide/angular bundle on the way, which can exceed the default hook timeout.
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideTranslateService()],
    })
      .compileComponents();
  }, 60_000);

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
