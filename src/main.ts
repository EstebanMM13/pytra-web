import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { applyStoredTheme } from './app/core/services/theme.service';
import { applyStoredMotion } from './app/core/services/preferences.service';

// Before bootstrap so the first paint already uses the stored theme.
applyStoredTheme();
applyStoredMotion();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
