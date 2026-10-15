import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * "Pytra" wordmark. P, t and r take the brand purple to hint at the slogan
 * (Play · Track · Remember); y and a keep the text color. Screen readers get the plain name.
 * Size, weight and tracking come from the host classes.
 */
@Component({
  selector: 'app-pytra-wordmark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block leading-none text-text', role: 'img', 'aria-label': 'Pytra' },
  template: `<span aria-hidden="true"
    ><span class="text-brand-light">P</span>y<span class="text-brand-light">tr</span>a</span
  >`,
})
export class PytraWordmark {}
