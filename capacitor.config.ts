import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.estebanmm13.pytra',
  appName: 'Pytra',
  webDir: 'dist/pytra-web/browser',
  // WebView background until the web app paints: the splash purple, so the native splash, the
  // load gap and the in-app intro read as one surface.
  backgroundColor: '#1e1833',
};

export default config;
