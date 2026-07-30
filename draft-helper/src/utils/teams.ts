const teamAliases: Record<string, string> = {
  LA: 'LAR',
  JAC: 'JAX',
};

const freeAgentValues = new Set(['FA', 'FREE AGENT', 'FREE AGENTS']);

export function normalizeTeam(team: string): string {
  const normalized = team.trim().toUpperCase();
  return teamAliases[normalized] ?? normalized;
}

export function isFreeAgentTeam(team: string): boolean {
  return freeAgentValues.has(normalizeTeam(team));
}

export function isNflTeam(team: string): boolean {
  const normalized = normalizeTeam(team);
  return normalized !== '' && !isFreeAgentTeam(normalized);
}
