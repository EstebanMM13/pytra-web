import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StatCard } from '../ui/stat-card';
import { setMotionPreference } from './motion';

@Component({
  imports: [StatCard],
  template: `<app-stat-card label="Hours" value="12" />`,
})
class Host {}

/**
 * The global motion gates (src/motion.css), injected as the app stylesheet would. Read through
 * Node (tests run in Node + jsdom); the specifier is a variable so the bundler leaves it alone.
 */
async function injectMotionCss(): Promise<HTMLStyleElement> {
  const fsModule = 'node:fs';
  const fs = (await import(/* @vite-ignore */ fsModule)) as { readFileSync(path: string, encoding: string): string };
  const style = document.createElement('style');
  style.textContent = fs.readFileSync('src/motion.css', 'utf8');
  document.head.appendChild(style);
  return style;
}

describe('CSS motion gates (data-motion)', () => {
  let style: HTMLStyleElement;

  beforeEach(async () => {
    style = await injectMotionCss();
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([])] });
  });

  afterEach(() => {
    style.remove();
    setMotionPreference('system');
    delete document.documentElement.dataset['motion'];
  });

  function renderCard(): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('app-stat-card') as HTMLElement;
  }

  /** The element-level selectors of the motion.css rules that switch animations off. */
  function animationKillSelectors(): string[] {
    return [...style.sheet!.cssRules]
      .filter((rule): rule is CSSStyleRule => 'selectorText' in rule && /animation:\s*none/.test(rule.cssText))
      .flatMap((rule) => rule.selectorText.split(','))
      .map((selector) => selector.trim())
      .filter((selector) => !selector.includes('::'));
  }

  /** jsdom computes no animations, so check that a kill rule applies to the card instead. */
  function animationSwitchedOff(card: HTMLElement): boolean {
    return animationKillSelectors().some((selector) => card.matches(selector));
  }

  it('declares the StatCard entrance animation (gated only by motion.css)', () => {
    renderCard();
    const componentCss = [...document.querySelectorAll('style')].filter((s) => s !== style).map((s) => s.textContent ?? '').join(' ');
    expect(componentCss).toContain('stat-card-in');
    expect(componentCss).not.toContain('prefers-reduced-motion');
  });

  it('keeps the StatCard entrance with full motion', () => {
    setMotionPreference('full');
    expect(animationSwitchedOff(renderCard())).toBe(false);
  });

  it('switches the StatCard entrance off with reduced motion', () => {
    setMotionPreference('reduce');
    expect(animationSwitchedOff(renderCard())).toBe(true);
  });

  it('zeroes the hover/press movement scale with reduced motion', () => {
    setMotionPreference('reduce');
    expect(getComputedStyle(document.documentElement).getPropertyValue('--pt-motion').trim()).toBe('0');
    setMotionPreference('full');
    expect(getComputedStyle(document.documentElement).getPropertyValue('--pt-motion').trim()).toBe('1');
  });
});
