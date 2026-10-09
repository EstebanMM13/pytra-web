import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { applyStoredTheme } from './app/core/services/theme.service';

// Before bootstrap so the first paint already uses the stored theme.
applyStoredTheme();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
