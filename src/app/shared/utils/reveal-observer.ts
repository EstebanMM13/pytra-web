/**
 * One IntersectionObserver shared by every element that reveals on scroll (see GameCover). Each
 * element registers a callback, called with its visibility and its position among the elements
 * that turned visible in the same batch (for a stagger). The observer is created on the first
 * registration and disconnected once nothing is left to watch.
 */
export type RevealCallback = (visible: boolean, batchIndex: number) => void;

const callbacks = new Map<Element, RevealCallback>();
let observer: IntersectionObserver | null = null;

/** Whether this engine can observe intersections (false in jsdom / SSR). */
export function canObserveReveal(): boolean {
  return typeof IntersectionObserver === 'function';
}

function onEntries(entries: IntersectionObserverEntry[]): void {
  let batchIndex = 0;
  for (const entry of entries) {
    const callback = callbacks.get(entry.target);
    if (callback) {
      callback(entry.isIntersecting, entry.isIntersecting ? batchIndex++ : 0);
    }
  }
}

/** Starts watching `el`; returns the function that stops (also safe to call twice). */
export function observeReveal(el: Element, callback: RevealCallback): () => void {
  if (!canObserveReveal()) {
    return () => undefined;
  }
  observer ??= new IntersectionObserver(onEntries);
  callbacks.set(el, callback);
  observer.observe(el);
  return () => unobserveReveal(el);
}

/** Stops watching `el`, and drops the observer when it was the last one. */
export function unobserveReveal(el: Element): void {
  if (!callbacks.delete(el) || !observer) {
    return;
  }
  observer.unobserve(el);
  if (callbacks.size === 0) {
    observer.disconnect();
    observer = null;
  }
}
