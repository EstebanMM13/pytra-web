import { Validators } from '@angular/forms';

/**
 * Mirrors the API's username rules (UsernamePolicy): 3-30 characters, only letters, digits, '.', '_' or '-'.
 * Never '@', so a username can not be confused with an email at sign-in.
 */
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,30}$/;

export const usernameValidators = [Validators.required, Validators.pattern(USERNAME_PATTERN)];
