import { Effect } from "effect";
import type { DraftPlatformAdapter } from "./types";

const TEAMS = 12;

function draftCapital(pick: number): number {
  return Math.round(5000 * Math.exp(-Math.pow((pick - 1) / 52, 0.74)));
}

export const underdogAdapter: DraftPlatformAdapter = {
  id: "underdog",
  label: "Underdog",
  teamCount: TEAMS,
  roundCount: 18,
  capitalCeilings: [
    { pos: ['QB'], label: 'QB', maxCapital: 3200 },
    { pos: ['RB'], label: 'RB', maxCapital: 8200 },
    { pos: ['WR'], label: 'WR', maxCapital: 11800 },
    { pos: ['TE'], label: 'TE', maxCapital: 3200 },
  ],
  draftCapital,
  getDraftId: Effect.sync(() => {
    const path = `${window.location.hostname}${window.location.pathname}`;
    return `underdog:${path}`;
  }),
  readRoster: Effect.succeed([]),
  readAvailablePlayers: Effect.succeed([]),
  readUserPickNumber: Effect.succeed(null),
  ui: {
    injectPageStyles: () => undefined,
    findMountPoint: () => document.body,
    placeMount: (host, mountPoint) => {
      mountPoint.prepend(host);
    },
    findAvailablePlayersBody: () => null,
    getAvailablePlayerRows: () => [],
    parseAvailablePlayerRow: () => null,
  },
};

