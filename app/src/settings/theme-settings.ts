import type { PlatformId } from "../content/adapters";
import type { ThemeMode } from "../panels/styles";

const STORAGE_KEY = 'dh_theme_settings';

export interface ThemeSettings {
  readonly platformThemes: Record<PlatformId, ThemeMode>;
}

export const defaultThemeSettings: ThemeSettings = {
  platformThemes: {
    draftkings: 'light',
    underdog: 'dark',
  },
};

function chromeStorage() {
  return globalThis.chrome?.storage?.local ?? null;
}

function normalizeTheme(value: unknown): ThemeMode | null {
  return value === 'light' || value === 'dark' ? value : null;
}

function normalizeSettings(value: unknown): ThemeSettings {
  const candidate = value as Partial<ThemeSettings> | null;
  return {
    platformThemes: {
      draftkings: normalizeTheme(candidate?.platformThemes?.draftkings) ?? defaultThemeSettings.platformThemes.draftkings,
      underdog: normalizeTheme(candidate?.platformThemes?.underdog) ?? defaultThemeSettings.platformThemes.underdog,
    },
  };
}

export async function getThemeSettings(): Promise<ThemeSettings> {
  const storage = chromeStorage();
  if (storage) {
    try {
      const result = await storage.get(STORAGE_KEY);
      return normalizeSettings(result[STORAGE_KEY]);
    } catch {
      // Fall through to localStorage.
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : defaultThemeSettings;
  } catch {
    return defaultThemeSettings;
  }
}

export async function saveThemeSettings(settings: ThemeSettings): Promise<void> {
  const normalized = normalizeSettings(settings);
  const storage = chromeStorage();
  if (storage) {
    try {
      await storage.set({ [STORAGE_KEY]: normalized });
      return;
    } catch {
      // Fall through to localStorage.
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function getPlatformTheme(settings: ThemeSettings, platformId: PlatformId): ThemeMode {
  return settings.platformThemes[platformId];
}
