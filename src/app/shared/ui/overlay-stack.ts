/**
 * Modal overlays open right now (sheets, pickers), oldest first: the last one is on top and is the
 * only one that should react to Escape. Page scroll stays locked while any is open and the body's
 * original overflow comes back when the last one closes, whatever the closing order.
 */
const stack: object[] = [];
/** Body overflow before the first overlay locked it; null while nothing is open. */
let savedOverflow: string | null = null;

export function openOverlay(owner: object, body: HTMLElement): void {
  if (!stack.includes(owner)) stack.push(owner);
  if (savedOverflow === null) {
    savedOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
  }
}

export function closeOverlay(owner: object, body: HTMLElement): void {
  const index = stack.indexOf(owner);
  if (index >= 0) stack.splice(index, 1);
  if (stack.length === 0 && savedOverflow !== null) {
    body.style.overflow = savedOverflow;
    savedOverflow = null;
  }
}

export function isTopOverlay(owner: object): boolean {
  return stack.at(-1) === owner;
}

/** Keeps Tab / Shift+Tab cycling inside `container` (a modal's focus trap). */
export function trapTab(event: KeyboardEvent, container: HTMLElement, focusables: readonly HTMLElement[]): void {
  if (event.key !== 'Tab' || focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = container.ownerDocument.activeElement;
  if (event.shiftKey && (active === first || active === container)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
