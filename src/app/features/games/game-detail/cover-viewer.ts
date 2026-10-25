import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { nextCoverSource } from '../../../shared/ui/game-cover';
import { ICONS } from '../../../shared/ui/icons';
import { closeOverlay, isTopOverlay, openOverlay } from '../../../shared/ui/overlay-stack';

/** IGDB size for the viewer: `t_1080p` fits the cover in 1920x1080 (810x1080 for a 3:4 cover). */
const IGDB_LARGE_SIZE = 't_1080p';

/** The `/t_<size>/` segment of an images.igdb.com url. */
const IGDB_IMAGE_SIZE = /^((?:https?:)?\/\/images\.igdb\.com\/igdb\/image\/upload\/)t_[a-z0-9_]+\//i;

/** Steam's 600x900 library capsule, whose `_2x` sibling is 1200x1800. */
const STEAM_LIBRARY_CAPSULE = /(\/steam\/apps\/\d+\/library_600x900)\.jpg(\?.*)?$/i;

/**
 * The largest variant of a stored cover url: IGDB's `t_1080p`, Steam's 2x library capsule; any other
 * url (custom) unchanged. If it fails, the viewer falls back to the stored url (see `nextCoverSource`).
 */
export function largeCoverUrl(url: string): string {
  if (IGDB_IMAGE_SIZE.test(url)) return url.replace(IGDB_IMAGE_SIZE, `$1${IGDB_LARGE_SIZE}/`);
  return url.replace(STEAM_LIBRARY_CAPSULE, '$1_2x.jpg$2');
}

/** History entry marker pushed while the viewer is open, so the back button closes it. */
const HISTORY_KEY = 'pytraCoverViewer';

/**
 * Fullscreen cover: the image as large as the screen allows (object-contain) over a dark backdrop.
 * The stored cover (already cached by the hero) shows at once and the large variant fades in over it
 * once loaded. Closes on any tap, Escape or the back button (it pushes a history entry while open);
 * focus moves to the close button and back to the opener on close, Tab stays on it, and page scroll
 * is locked. The host moves to <body> so no transformed ancestor clips the fixed overlay.
 */
@Component({
  selector: 'app-cover-viewer',
  imports: [LucideDynamicIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape($event)',
    '(window:popstate)': 'onPopState()',
  },
  template: `
    <div
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="'game.coverOf' | translate: { name: name() }"
      class="fixed inset-0 z-50 grid animate-modal-in grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] cursor-zoom-out place-items-center bg-black/90 p-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)] backdrop-blur-sm md:p-8"
      (click)="close()"
      (keydown.tab)="$event.preventDefault()"
      data-cover-viewer
    >
      @if (baseSrc(); as base) {
        <img
          [src]="base"
          alt=""
          aria-hidden="true"
          decoding="async"
          referrerpolicy="no-referrer"
          class="col-start-1 row-start-1 size-full object-contain select-none"
          [class.invisible]="largeLoaded()"
          (error)="onBaseError(base)"
        />
      }
      @if (largeSrc(); as src) {
        <img
          [src]="src"
          [alt]="name()"
          decoding="async"
          referrerpolicy="no-referrer"
          class="col-start-1 row-start-1 size-full object-contain transition-opacity duration-200 select-none"
          [class.opacity-0]="!largeLoaded()"
          (load)="largeLoaded.set(true)"
          (error)="onLargeError()"
        />
      }
      <button
        #closeButton
        type="button"
        class="absolute top-[calc(env(safe-area-inset-top)+12px)] right-3 rounded-full bg-black/50 p-2 text-white/85 hover:text-white md:top-5 md:right-5"
        [attr.aria-label]="'common.close' | translate"
        (click)="$event.stopPropagation(); close()"
      >
        <svg [lucideIcon]="icons.x" [size]="22" aria-hidden="true"></svg>
      </button>
    </div>
  `,
})
export class CoverViewer {
  protected readonly icons = ICONS;

  /** The stored cover url. */
  readonly url = input.required<string>();
  readonly name = input.required<string>();
  readonly closed = output<void>();

  private readonly large = computed(() => largeCoverUrl(this.url()));
  /** The stored cover, then its Steam fallbacks if it fails (as in the hero); null hides it. */
  protected readonly baseSrc = linkedSignal<string | null>(() => this.url());
  /** The large variant fading in over the stored cover; null when there is none or it failed. */
  protected readonly largeSrc = linkedSignal<string | null>(() => (this.large() !== this.url() ? this.large() : null));
  protected readonly largeLoaded = signal(false);

  private readonly document = inject(DOCUMENT);
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');
  private historyPushed = false;
  private done = false;

  constructor() {
    const body = this.document.body;
    const window = this.document.defaultView;
    const previousFocus = this.document.activeElement as HTMLElement | null;
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    openOverlay(this, body);

    if (window?.history) {
      window.history.pushState({ ...(window.history.state ?? {}), [HISTORY_KEY]: true }, '');
      this.historyPushed = true;
    }

    inject(DestroyRef).onDestroy(() => {
      host.remove();
      closeOverlay(this, body);
      // Closed without the back button (tap, Escape, leaving the page): drop the entry it pushed.
      if (this.historyPushed && window?.history.state?.[HISTORY_KEY]) window.history.back();
      previousFocus?.focus?.();
    });

    afterNextRender(() => {
      if (host.parentNode !== body) body.appendChild(host);
      this.closeButton().nativeElement.focus();
    });
  }

  close(): void {
    if (this.done) return;
    this.done = true;
    this.closed.emit();
  }

  protected onEscape(event: Event): void {
    if (!event.defaultPrevented && isTopOverlay(this)) {
      event.preventDefault();
      this.close();
    }
  }

  /** Back button: the entry this viewer pushed is gone, so nothing is left to pop on close. */
  protected onPopState(): void {
    if (this.document.defaultView?.history.state?.[HISTORY_KEY]) return;
    this.historyPushed = false;
    this.close();
  }

  /** The stored cover underneath stays (it is the next source anyway). */
  protected onLargeError(): void {
    this.largeLoaded.set(false);
    this.largeSrc.set(null);
  }

  protected onBaseError(failed: string): void {
    this.baseSrc.set(nextCoverSource(this.url(), failed));
  }
}
