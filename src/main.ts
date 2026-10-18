import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { applyStoredTheme } from './app/core/services/theme.service';
import { applyStoredMotion } from './app/core/services/preferences.service';
import { isNativePlatform } from './app/core/native-platform';
import { stashInstallPrompt } from './app/core/install-prompt-stash';

// Before bootstrap so the first paint already uses the stored theme.
applyStoredTheme();
applyStoredMotion();
// Native shell flag for CSS (e.g. card-glass drops its blur in the Android WebView).
if (isNativePlatform()) {
  document.documentElement.dataset['native'] = '';
} else {
  // Catch the early beforeinstallprompt; InstallPromptService (lazy) reads it later.
  stashInstallPrompt();
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
