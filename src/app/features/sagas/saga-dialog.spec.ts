import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { DemoModeService } from '../../core/services/demo-mode.service';
import { SagaService } from '../../core/services/saga.service';
import { ToastService } from '../../shared/toast/toast.service';
import { SagaDialog } from './saga-dialog';

const SAGA = { id: 3, name: 'Zelda', updatedAt: '2026-01-01T00:00:00' };

describe('SagaDialog', () => {
  function setup(demo: boolean) {
    const sagaService = { create: vi.fn(() => of(SAGA)), update: vi.fn(() => of(SAGA)), delete: vi.fn() };
    const blockWrite = vi.fn(() => demo);
    TestBed.configureTestingModule({
      imports: [SagaDialog],
      providers: [
        provideTranslateService(),
        { provide: SagaService, useValue: sagaService },
        { provide: DemoModeService, useValue: { isDemo: signal(demo), blockWrite } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(SagaDialog);
    fixture.componentRef.setInput('saga', SAGA);
    const closed = vi.fn();
    const saved = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.saved.subscribe(saved);
    fixture.detectChanges();
    const sheet = () => document.body.querySelector('app-modal-sheet') as HTMLElement;
    const saveButtons = () =>
      [...sheet().querySelectorAll('button')].filter((b) => ['sagas.saveEdit', 'common.save'].includes(b.textContent!.trim()));
    return { fixture, sagaService, blockWrite, closed, saved, sheet, saveButtons };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('opens in the demo with a notice, and neither save button nor Enter sends anything', () => {
    const { fixture, sagaService, blockWrite, closed, saved, sheet, saveButtons } = setup(true);
    expect(sheet().querySelector('[data-demo-notice]')?.textContent).toContain('demo.dialogNotice');
    expect(saveButtons()).toHaveLength(2);
    for (const button of saveButtons()) {
      button.click();
    }
    sheet().querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(blockWrite).toHaveBeenCalledTimes(3);
    expect(sagaService.update).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    expect(sheet()).not.toBeNull();
  });

  it('saves outside the demo, without the notice', () => {
    const { sagaService, saved, sheet, saveButtons } = setup(false);
    expect(sheet().querySelector('[data-demo-notice]')).toBeNull();
    saveButtons()[1].click();
    expect(sagaService.update).toHaveBeenCalledWith(3, { name: 'Zelda' });
    expect(saved).toHaveBeenCalledWith(SAGA);
  });
});
