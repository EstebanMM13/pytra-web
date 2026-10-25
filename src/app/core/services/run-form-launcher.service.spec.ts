import { TestBed } from '@angular/core/testing';
import { Experience } from '../models/experience.model';
import { RunFormLauncher } from './run-form-launcher.service';

const run = (id: number) => ({ id, runLabel: 'Importado de PlayStation' }) as Experience;

describe('RunFormLauncher', () => {
  let launcher: RunFormLauncher;

  beforeEach(() => {
    launcher = TestBed.inject(RunFormLauncher);
  });

  it('edits queued runs one after another, whether each is saved or closed', () => {
    launcher.openEditRuns([run(1), run(2), run(3)]);
    expect(launcher.request()).toEqual({ mode: 'edit', experience: run(1) });

    launcher.notifySaved({ experience: run(1), created: false });
    expect(launcher.request()).toEqual({ mode: 'edit', experience: run(2) });

    launcher.close();
    expect(launcher.request()).toEqual({ mode: 'edit', experience: run(3) });

    launcher.close();
    expect(launcher.request()).toBeNull();
  });

  it('a single run behaves like openEditRun and an empty list opens nothing', () => {
    launcher.openEditRuns([]);
    expect(launcher.request()).toBeNull();

    launcher.openEditRuns([run(1)]);
    launcher.close();
    expect(launcher.request()).toBeNull();
  });

  it('any other open request drops the queued runs', () => {
    launcher.openEditRuns([run(1), run(2)]);
    launcher.openNewRun(7);
    launcher.close();
    expect(launcher.request()).toBeNull();

    launcher.openEditRuns([run(1), run(2)]);
    launcher.openEditRun(run(9));
    launcher.close();
    expect(launcher.request()).toBeNull();
  });

  it('still notifies listeners when a queued run is saved', () => {
    const saved = vi.fn();
    launcher.saved$.subscribe(saved);
    launcher.openEditRuns([run(1), run(2)]);

    launcher.notifySaved({ experience: run(1), created: false });

    expect(saved).toHaveBeenCalledWith({ experience: run(1), created: false });
  });
});
