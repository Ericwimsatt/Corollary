import type { Effect } from "effect";
import type { Player, Position, RosterPick } from "../types";

export type PlatformId = "draftkings" | "underdog";

export interface CapitalCeiling {
  readonly pos: ReadonlyArray<Position>;
  readonly label: Position;
  readonly maxCapital: number;
}

export interface AvailablePlayerRow {
  readonly row: Element;
  readonly rankCell: HTMLElement | null;
  readonly playerCell: Element | null;
  readonly detailsContainer: HTMLElement | null;
  readonly byeCell: HTMLElement | null;
  readonly byeNumber: HTMLElement | null;
  readonly byeNumberSpan: HTMLElement | null;
  readonly rank: number;
  readonly name: string;
  readonly position: Position;
  readonly team: string;
  readonly adp: number;
  readonly byeWeek: number;
}

export interface PlatformUiAdapter {
  readonly injectPageStyles: () => void;
  readonly findMountPoint: () => Element | null;
  readonly placeMount: (host: HTMLElement, mountPoint: Element) => void;
  readonly findAvailablePlayersBody: () => Element | null;
  readonly getAvailablePlayerRows: (body: Element) => ReadonlyArray<Element>;
  readonly parseAvailablePlayerRow: (row: Element) => AvailablePlayerRow | null;
}

export interface DraftPlatformAdapter {
  readonly id: PlatformId;
  readonly label: string;
  readonly teamCount: number;
  readonly roundCount: number;
  readonly capitalCeilings: ReadonlyArray<CapitalCeiling>;
  readonly draftCapital: (overallPick: number) => number;
  readonly getDraftId: Effect.Effect<string>;
  readonly readRoster: Effect.Effect<ReadonlyArray<RosterPick>>;
  readonly readAvailablePlayers: Effect.Effect<ReadonlyArray<Player>>;
  readonly readUserPickNumber: Effect.Effect<number | null>;
  readonly ui: PlatformUiAdapter;
}

