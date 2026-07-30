export interface TeamInfo {
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

const teams: Record<string, TeamInfo> = {
  ARI: { name: 'Arizona Cardinals', primaryColor: '#97233F', secondaryColor: '#FFB612' },
  ATL: { name: 'Atlanta Falcons', primaryColor: '#A71930', secondaryColor: '#A5ACAF' },
  BAL: { name: 'Baltimore Ravens', primaryColor: '#241773', secondaryColor: '#9E7C0C' },
  BUF: { name: 'Buffalo Bills', primaryColor: '#00338D', secondaryColor: '#C60C30' },
  CAR: { name: 'Carolina Panthers', primaryColor: '#0085CA', secondaryColor: '#101820' },
  CHI: { name: 'Chicago Bears', primaryColor: '#0B162A', secondaryColor: '#C83803' },
  CIN: { name: 'Cincinnati Bengals', primaryColor: '#FB4F14', secondaryColor: '#000000' },
  CLE: { name: 'Cleveland Browns', primaryColor: '#311D00', secondaryColor: '#FF3C00' },
  DAL: { name: 'Dallas Cowboys', primaryColor: '#002244', secondaryColor: '#869397' },
  DEN: { name: 'Denver Broncos', primaryColor: '#002244', secondaryColor: '#FB4F14' },
  DET: { name: 'Detroit Lions', primaryColor: '#0076B6', secondaryColor: '#B0B7BC' },
  GB: { name: 'Green Bay Packers', primaryColor: '#203731', secondaryColor: '#FFB612' },
  HOU: { name: 'Houston Texans', primaryColor: '#00143F', secondaryColor: '#A71930' },
  IND: { name: 'Indianapolis Colts', primaryColor: '#002C5F', secondaryColor: '#A2AAAD' },
  JAC: { name: 'Jacksonville Jaguars', primaryColor: '#006778', secondaryColor: '#D7A22A' },
  JAX: { name: 'Jacksonville Jaguars', primaryColor: '#006778', secondaryColor: '#D7A22A' },
  KC: { name: 'Kansas City Chiefs', primaryColor: '#E31837', secondaryColor: '#FFB612' },
  LV: { name: 'Las Vegas Raiders', primaryColor: '#000000', secondaryColor: '#A5ACAF' },
  LAC: { name: 'Los Angeles Chargers', primaryColor: '#0080C6', secondaryColor: '#FFC20E' },
  LAR: { name: 'Los Angeles Rams', primaryColor: '#003594', secondaryColor: '#FFA300' },
  MIA: { name: 'Miami Dolphins', primaryColor: '#008E97', secondaryColor: '#FC4C02' },
  MIN: { name: 'Minnesota Vikings', primaryColor: '#4F2683', secondaryColor: '#FFC62F' },
  NE: { name: 'New England Patriots', primaryColor: '#002244', secondaryColor: '#C60C30' },
  NO: { name: 'New Orleans Saints', primaryColor: '#101820', secondaryColor: '#D3BC8D' },
  NYG: { name: 'New York Giants', primaryColor: '#0B2265', secondaryColor: '#A71930' },
  NYJ: { name: 'New York Jets', primaryColor: '#125740', secondaryColor: '#000000' },
  PHI: { name: 'Philadelphia Eagles', primaryColor: '#004C54', secondaryColor: '#A5ACAF' },
  PIT: { name: 'Pittsburgh Steelers', primaryColor: '#000000', secondaryColor: '#FFB612' },
  SF: { name: 'San Francisco 49ers', primaryColor: '#AA0000', secondaryColor: '#B3995D' },
  SEA: { name: 'Seattle Seahawks', primaryColor: '#002244', secondaryColor: '#69BE28' },
  TB: { name: 'Tampa Bay Buccaneers', primaryColor: '#D50A0A', secondaryColor: '#FF7900' },
  TEN: { name: 'Tennessee Titans', primaryColor: '#002244', secondaryColor: '#4B92DB' },
  WAS: { name: 'Washington Commanders', primaryColor: '#5A1414', secondaryColor: '#FFB612' },
};

export function getTeamInfo(abbr: string): TeamInfo | undefined {
  return teams[abbr];
}
