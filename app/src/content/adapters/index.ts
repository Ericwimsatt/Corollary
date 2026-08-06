import { draftKingsAdapter } from "./draftkings";
import type { DraftPlatformAdapter, PlatformId } from "./types";
import { underdogAdapter } from "./underdog";
import { getCachedPlatformSetting } from "../../settings/platform-settings";

export { draftKingsAdapter, underdogAdapter };

const adapters: Record<PlatformId, DraftPlatformAdapter> = {
  draftkings: draftKingsAdapter,
  underdog: underdogAdapter,
};

export function getAdapter(platformId: PlatformId): DraftPlatformAdapter {
  return adapters[platformId];
}

export function getActiveAdapter(): DraftPlatformAdapter {
  const override = getCachedPlatformSetting();
  if (override !== 'auto') {
    return adapters[override];
  }
  const host = window.location.hostname.toLowerCase();
  if (host.includes('underdogsports.com') || host.includes('underdogfantasy.com')) {
    return adapters.underdog;
  }
  return adapters.draftkings;
}

export type { DraftPlatformAdapter, PlatformId } from "./types";
