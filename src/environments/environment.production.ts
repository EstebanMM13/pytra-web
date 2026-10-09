// Production environment: `npm run build` (default configuration), the Docker image and the
// Capacitor Android app. Keep apiOrigin in sync with connect-src in nginx.conf.template.
export const environment = {
  production: true,
  apiOrigin: 'https://pytra-api-production.up.railway.app',
};
