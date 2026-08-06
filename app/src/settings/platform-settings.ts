import type { PlatformId } from "../content/adapters/types";

const STORAGE_KEY = 'dh_platform_setting';

export type PlatformOverride = PlatformId | 'auto';

export const defaultPlatformOverride: PlatformOverride = 'auto';

function chromeStorage() {
  return globalThis.chrome?.storage?.local ?? null;
}

function normalize(value: unknown): PlatformOverride {
  if (value === 'auto' || value === 'draftkings' || value === 'underdog') return value;
  return defaultPlatformOverride;
}

let cached: PlatformOverride | undefined;

function readLocal(): PlatformOverride {
  if (cached !== undefined) return cached;
  try {
    cached = normalize(localStorage.getItem(STORAGE_KEY));
  } catch {
    cached = defaultPlatformOverride;
  }
  return cached;
}

function writeLocal(value: PlatformOverride) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

/** Synchronous read for non-React call sites (pipeline, content injection). */
export function getCachedPlatformSetting(): PlatformOverride {
  return readLocal();
}

export async function getPlatformSetting(): Promise<PlatformOverride> {
  if (cached !== undefined) return cached;

  const storage = chromeStorage();
  if (storage) {
    try {
      const result = await storage.get(STORAGE_KEY);
      const loaded = normalize(result[STORAGE_KEY]);
      cached = loaded;
      writeLocal(loaded);
      return loaded;
    } catch {
      // Fall through to localStorage.
    }
  }

  return readLocal();
}

export async function savePlatformSetting(value: PlatformOverride): Promise<void> {
  const normalized = normalize(value);
  cached = normalized;
  writeLocal(normalized);

  const storage = chromeStorage();
  if (storage) {
    try {
      await storage.set({ [STORAGE_KEY]: normalized });
      return;
    } catch {
      // Fall through; localStorage already written.
    }
  }
}

export function clearPlatformSettingCache(): void {
  cached = undefined;
}