import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RunFormLauncher } from './core/services/run-form-launcher.service';
import { RunForm } from './features/games/run-form/run-form';
import { ToastHost } from './shared/toast/toast-host';

@Component({
  imports: [RouterOutlet, RunForm, ToastHost],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly runFormLauncher = inject(RunFormLauncher);

  /** One-item list so each new open request gets a fresh form instance (tracked by identity). */
  protected readonly runFormRequests = computed(() => {
    const request = this.runFormLauncher.request();
    return request ? [request] : [];
  });
}
