/**
 * Numeric figures the count-up understands: plain integers/decimals with an optional
 * unit suffix ("42", "9.25", "112,9 h"). Anything else (grouped numbers, "3 / 10", "—") renders as-is.
 */
const COUNT_UP_PATTERN = /^(\d+)(?:([.,])(\d+))?(\s*h)?$/;

export interface CountUp {
  target: number;
  /** Formats an intermediate value like the final text (same decimals, separator and unit). */
  format: (n: number) => string;
}

export function parseCountUp(text: string): CountUp | null {
  const match = COUNT_UP_PATTERN.exec(text);
  if (!match) return null;
  const [, int, sep = '', frac = '', suffix = ''] = match;
  const decimals = frac.length;
  return {
    target: Number(`${int}.${frac || '0'}`),
    format: (n) => n.toFixed(decimals).replace('.', sep) + suffix,
  };
}

/** Fast start, gentle landing; `t` is clamped to 0..1. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

/** Value shown `elapsed` ms into a count-up of `duration` ms towards `target`: eased, exactly `target` at the end. */
export function countUpValue(target: number, elapsed: number, duration: number): number {
  if (!(duration > 0) || elapsed >= duration) return target;
  return target * easeOutCubic(elapsed / duration);
}
