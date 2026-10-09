import type { BrainboxStorage } from './types';

/** In-memory storage used when AsyncStorage is not installed (state lasts for the app session). */
export function createMemoryStorage(): BrainboxStorage {
  const map = new Map<string, string>();
  return {
    async getItem(key) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    async setItem(key, value) {
      map.set(key, String(value));
    },
    async removeItem(key) {
      map.delete(key);
    }
  };
}

let cached: BrainboxStorage | null = null;

/**
 * `@react-native-async-storage/async-storage` when installed (optional peer dependency), else an
 * in-memory store. The literal require inside try/catch is Metro's optional-dependency pattern
 * (enabled by default in Expo and @react-native/metro-config). If your bundler refuses it, pass a
 * `storage` prop explicitly instead.
 */
export function getDefaultStorage(): BrainboxStorage {
  if (cached) return cached;
  let s: BrainboxStorage | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage');
    const candidate = mod && (mod.default || mod);
    if (candidate && typeof candidate.getItem === 'function' && typeof candidate.setItem === 'function') s = candidate;
  } catch {
    s = null;
  }
  cached = s || createMemoryStorage();
  return cached;
}
