export interface FootballArea {
  id: number;
  name: string;
  code: string;
  flag: string | null;
}

export interface FootballCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
  arabicName?: string;
}

export interface FootballSeason {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday: number;
  winner: any;
}

export interface FootballTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  arabicName?: string;
}

export interface FootballTimeScore {
  home: number | null;
  away: number | null;
}

export interface FootballScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT';
  fullTime: FootballTimeScore;
  halfTime: FootballTimeScore;
}

export type FootballMatchStatus =
  | 'LIVE'
  | 'SCHEDULED'
  | 'TIMED'
  | 'CALENDAR'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'EXTRA_TIME'
  | 'PENALTY_SHOOTOUT'
  | 'FINISHED'
  | 'SUSPENDED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'AWARDED';

export interface FootballMatch {
  id: number;
  utcDate: string;
  status: FootballMatchStatus;
  matchday?: number;
  stage?: string;
  group?: string | null;
  lastUpdated: string;
  homeTeam: FootballTeam;
  awayTeam: FootballTeam;
  score: FootballScore;
  competition: FootballCompetition;
  minute?: number;
  channel?: string;
  commentator?: string;
}

export interface FootballStandingRow {
  position: number;
  team: FootballTeam;
  playedGames: number;
  form?: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface FootballStandingGroup {
  stage: string;
  type: 'TOTAL' | 'HOME' | 'AWAY';
  group?: string | null;
  table: FootballStandingRow[];
}

export interface FootballStandingsResponse {
  filters: Record<string, any>;
  area: FootballArea;
  competition: FootballCompetition;
  season: FootballSeason;
  standings: FootballStandingGroup[];
}

export interface FootballMatchesResponse {
  filters: Record<string, any>;
  resultSet: {
    count: number;
    competitions?: string;
    first?: string;
    last?: string;
    played?: number;
  };
  matches: FootballMatch[];
}

export interface CompetitionMeta {
  code: string;
  id: number;
  apiSportsId?: number;
  name: string;
  arabicName: string;
  emblem: string;
  country: string;
  color: string;
}

