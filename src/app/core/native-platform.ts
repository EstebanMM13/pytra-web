/**
 * True inside the Capacitor native shell (Android / iOS), false on the web.
 *
 * Same detection as `Capacitor.isNativePlatform()` (a custom platform, or the native bridge the
 * shell injects before the app loads), without pulling `@capacitor/core` into the initial bundle:
 * the plugins are imported lazily, only on native code paths.
 */
export function isNativePlatform(win: unknown = globalThis): boolean {
  const w = win as {
    CapacitorCustomPlatform?: { name?: string } | null;
    androidBridge?: unknown;
    webkit?: { messageHandlers?: { bridge?: unknown } };
  } | null;
  if (!w) {
    return false;
  }
  if (w.CapacitorCustomPlatform) {
    return w.CapacitorCustomPlatform.name !== 'web';
  }
  return !!w.androidBridge || !!w.webkit?.messageHandlers?.bridge;
}
