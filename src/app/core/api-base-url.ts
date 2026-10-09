import { environment } from '../../environments/environment';

// API origin per build configuration: localhost for `ng serve`, Railway for production builds
// (web and Android). See src/environments/.
export const API_ORIGIN = environment.apiOrigin;
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
