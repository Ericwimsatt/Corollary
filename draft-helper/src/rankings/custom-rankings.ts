export interface CustomRanking {
  name: string;
  position: string;
  team: string;
  rank: number;
}

export interface CustomRankingsData {
  rankings: CustomRanking[];
  updatedAt: number;
}

export interface RankingImportResult {
  rankings: CustomRanking[];
  skipped: number;
}

const STORAGE_KEY = 'dh_custom_rankings';

const TEAM_ALIASES: Record<string, string> = {
  LA: 'LAR',
};

const POSITION_ALIASES: Record<string, string> = {
  DST: 'DEF',
  D: 'DEF',
};

function chromeStorage() {
  return globalThis.chrome?.storage?.local ?? null;
}

export function normalizeRankingTeam(team: string): string {
  const normalized = team.trim().toUpperCase();
  return TEAM_ALIASES[normalized] ?? normalized;
}

export function normalizeRankingPosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return POSITION_ALIASES[normalized] ?? normalized;
}

export async function getCustomRankings(): Promise<CustomRankingsData | null> {
  const storage = chromeStorage();
  if (storage) {
    try {
      const result = await storage.get(STORAGE_KEY);
      const data = (result[STORAGE_KEY] ?? null) as CustomRankingsData | null;
      if (data) return data;
    } catch {
      // Fall through to localStorage.
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomRankingsData) : null;
  } catch {
    return null;
  }
}

export async function saveCustomRankings(rankings: CustomRanking[]): Promise<CustomRankingsData> {
  const data: CustomRankingsData = { rankings, updatedAt: Date.now() };
  const storage = chromeStorage();
  if (storage) {
    try {
      await storage.set({ [STORAGE_KEY]: data });
      return data;
    } catch {
      // Fall through to localStorage.
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

export async function clearCustomRankings(): Promise<void> {
  const storage = chromeStorage();
  if (storage) {
    try {
      await storage.remove(STORAGE_KEY);
    } catch {
      // Keep clearing localStorage below.
    }
  }
  localStorage.removeItem(STORAGE_KEY);
}

export function parseRankingsCsv(csv: string): RankingImportResult {
  const rows = parseCsvRows(csv).filter((row) => row.some((cell) => cell.trim() !== ''));
  if (rows.length === 0) return { rankings: [], skipped: 0 };

  const firstRow = rows[0].map(normalizeHeader);
  const headerMap = getHeaderMap(firstRow);
  const hasHeader = headerMap.name >= 0 && headerMap.position >= 0 && headerMap.team >= 0 && headerMap.rank >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const indexes = hasHeader ? headerMap : { name: 0, position: 1, team: 2, rank: 3 };

  const rankings: CustomRanking[] = [];
  let skipped = 0;

  for (const row of dataRows) {
    const name = (row[indexes.name] ?? '').trim();
    const position = normalizeRankingPosition(row[indexes.position] ?? '');
    const team = normalizeRankingTeam(row[indexes.team] ?? '');
    const rank = parseRank(row[indexes.rank] ?? '');

    if (!name || !position || !team || rank <= 0) {
      skipped++;
      continue;
    }

    rankings.push({ name, position, team, rank });
  }

  rankings.sort((a, b) => a.rank - b.rank);
  return { rankings, skipped };
}

function parseRank(value: string): number {
  const cleaned = value.trim().replace(/[^\d.]/g, '');
  return Math.round(Number(cleaned)) || 0;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getHeaderMap(headers: string[]) {
  return {
    name: findHeader(headers, ['name', 'player', 'playername']),
    position: findHeader(headers, ['position', 'pos']),
    team: findHeader(headers, ['team', 'nflteam']),
    rank: findHeader(headers, ['rank', 'etr', 'etrrank', 'overall', 'overallrank']),
  };
}

function findHeader(headers: string[], names: string[]): number {
  return headers.findIndex((header) => names.includes(header));
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}
