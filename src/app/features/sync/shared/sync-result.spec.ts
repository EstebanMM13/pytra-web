import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { SyncResult, SyncResultCounts } from './sync-result';

describe('SyncResult', () => {
  let fixture: ComponentFixture<SyncResult>;

  function setup(result: Partial<SyncResultCounts>) {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideTranslateService()] });
    fixture = TestBed.createComponent(SyncResult);
    fixture.componentRef.setInput('source', 'psn');
    fixture.componentRef.setInput('result', {
      gamesScanned: 10,
      newGamesPending: 4,
      linkedExisting: 3,
      gamesUpdated: 2,
      ignored: 0,
      skipped: 0,
      errored: 0,
      ...result,
    });
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent;

  it('shows the four figures under their source title', () => {
    setup({});
    expect(text()).toContain('psn.result.title');
    for (const key of ['scanned', 'newPending', 'linkedExisting', 'updated']) {
      expect(text()).toContain(`sync.result.${key}`);
    }
  });

  it('leaves out the notes when nothing was ignored, skipped or failed', () => {
    setup({});
    expect(text()).not.toContain('steam.result.ignored');
    expect(text()).not.toContain('psn.result.skipped');
    expect(text()).not.toContain('steam.result.errored');
  });

  it('adds a note for ignored, skipped (per source) and failed games', () => {
    setup({ ignored: 1, skipped: 2, errored: 3 });
    expect(text()).toContain('steam.result.ignored');
    expect(text()).toContain('psn.result.skipped');
    expect(text()).toContain('steam.result.errored');
  });
});
