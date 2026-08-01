import { draftKingsAdapter } from "./draftkings";
import type { DraftPlatformAdapter, PlatformId } from "./types";
import { underdogAdapter } from "./underdog";

export { draftKingsAdapter, underdogAdapter };

const adapters: Record<PlatformId, DraftPlatformAdapter> = {
  draftkings: draftKingsAdapter,
  underdog: underdogAdapter,
};

export function getActiveAdapter(): DraftPlatformAdapter {
  const host = window.location.hostname.toLowerCase();
  if (host.includes('underdogsports.com') || host.includes('underdogfantasy.com')) {
    return adapters.underdog;
  }
  return adapters.draftkings;
}

export type { DraftPlatformAdapter, PlatformId } from "./types";
