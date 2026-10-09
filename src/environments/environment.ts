// Development environment, used by `ng serve` and `ng build --configuration development`.
// Production builds swap this file for environment.production.ts (see fileReplacements in angular.json).
export const environment = {
  production: false,
  // Local pytra-api (`./mvnw spring-boot:run`). Its default CORS allows http://localhost:4200.
  apiOrigin: 'http://localhost:8080',
};
