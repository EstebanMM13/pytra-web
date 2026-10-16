import { isNativePlatform } from './native-platform';

describe('isNativePlatform', () => {
  it('detects the Android and iOS bridges and custom platforms', () => {
    expect(isNativePlatform({ androidBridge: {} })).toBe(true);
    expect(isNativePlatform({ webkit: { messageHandlers: { bridge: {} } } })).toBe(true);
    expect(isNativePlatform({ CapacitorCustomPlatform: { name: 'electron' } })).toBe(true);
    expect(isNativePlatform({ CapacitorCustomPlatform: { name: 'web' }, androidBridge: {} })).toBe(false);
  });

  it('is false on the web', () => {
    expect(isNativePlatform({})).toBe(false);
    expect(isNativePlatform({ webkit: {} })).toBe(false);
    expect(isNativePlatform(null)).toBe(false);
    expect(isNativePlatform()).toBe(false);
  });
});
