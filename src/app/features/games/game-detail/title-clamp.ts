import {
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

/**
 * A line-clamped title that expands to its full text when tapped. It is only interactive while the
 * clamp actually cuts the text (measured after render, when web fonts load, on resize, when the text
 * changes and after folding back), so a short title stays plain text. The host keeps its heading
 * role: the template puts the button semantics (role, tabindex, aria-expanded) on the text span
 * inside, read from `truncated()` and `expanded()`; clicks and Enter / Space on the host toggle it.
 */
@Directive({
  selector: '[appTitleClamp]',
  exportAs: 'titleClamp',
  host: {
    '[class.line-clamp-none!]': 'expanded()',
    '[class.cursor-pointer]': 'truncated()',
    '(click)': 'toggle()',
    '(keydown.enter)': 'onKey($event)',
    '(keydown.space)': 'onKey($event)',
  },
})
export class TitleClamp {
  /** The title text: a new one collapses the title and measures it again. */
  readonly appTitleClamp = input.required<string>();

  /** The clamp cuts the text (stays true while expanded, so it can fold back). */
  readonly truncated = signal(false);
  readonly expanded = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  constructor() {
    effect(() => {
      this.appTitleClamp();
      this.expanded.set(false);
      afterNextRender(() => this.measure(), { injector: this.injector });
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // A web font changes how many lines the text needs without resizing the clamped box.
      const fonts = this.host.ownerDocument.fonts;
      const remeasure = () => this.measure();
      fonts?.ready.then(remeasure, () => {});
      fonts?.addEventListener?.('loadingdone', remeasure);
      destroyRef.onDestroy(() => fonts?.removeEventListener?.('loadingdone', remeasure));
      if (typeof ResizeObserver !== 'function') return;
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(this.host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** Expanded, the clamp is off and there is nothing to measure: the last reading stands. */
  measure(): void {
    if (this.expanded()) return;
    this.truncated.set(this.host.scrollHeight > this.host.clientHeight + 1);
  }

  toggle(): void {
    if (!this.truncated()) return;
    this.expanded.update((open) => !open);
    // Folded back: the width may have changed while it was open, so check the cut again.
    if (!this.expanded()) afterNextRender(() => this.measure(), { injector: this.injector });
  }

  protected onKey(event: Event): void {
    if (!this.truncated()) return;
    event.preventDefault();
    this.toggle();
  }
}
