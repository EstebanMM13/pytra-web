import { observeReveal, unobserveReveal } from './reveal-observer';

/** Minimal IntersectionObserver: records targets and lets a test fire entries. */
class FakeObserver {
  static instances: FakeObserver[] = [];
  readonly targets = new Set<Element>();
  disconnected = false;

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.instances.push(this);
  }

  observe(el: Element): void {
    this.targets.add(el);
  }

  unobserve(el: Element): void {
    this.targets.delete(el);
  }

  disconnect(): void {
    this.disconnected = true;
    this.targets.clear();
  }

  fire(entries: [Element, boolean][]): void {
    this.callback(
      entries.map(([target, isIntersecting]) => ({ target, isIntersecting }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    );
  }
}

describe('observeReveal', () => {
  beforeEach(() => {
    FakeObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shares one observer and numbers the elements that turn visible in the same batch', () => {
    const [a, b, c] = [document.createElement('div'), document.createElement('div'), document.createElement('div')];
    const calls: string[] = [];
    observeReveal(a, (visible, i) => calls.push(`a:${visible}:${i}`));
    observeReveal(b, (visible, i) => calls.push(`b:${visible}:${i}`));
    observeReveal(c, (visible, i) => calls.push(`c:${visible}:${i}`));
    expect(FakeObserver.instances).toHaveLength(1);

    FakeObserver.instances[0].fire([
      [a, true],
      [b, false],
      [c, true],
    ]);
    expect(calls).toEqual(['a:true:0', 'b:false:0', 'c:true:1']);
    [a, b, c].forEach(unobserveReveal);
  });

  it('disconnects once the last element is unobserved, and starts afresh after', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const stopA = observeReveal(a, () => undefined);
    observeReveal(b, () => undefined);
    const first = FakeObserver.instances[0];

    stopA();
    stopA();
    expect(first.disconnected).toBe(false);
    unobserveReveal(b);
    expect(first.disconnected).toBe(true);

    const stop = observeReveal(a, () => undefined);
    expect(FakeObserver.instances).toHaveLength(2);
    stop();
  });

  it('is a no-op where IntersectionObserver is missing', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const stop = observeReveal(document.createElement('div'), () => undefined);
    expect(FakeObserver.instances).toHaveLength(0);
    expect(() => stop()).not.toThrow();
  });
});
