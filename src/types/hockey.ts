export type AgeGroup = '10U' | '12U' | '14U' | '16U' | '18U';
export type TierLevel = 'AAA' | 'AA' | 'A' | 'B';
export type RinkType = 'Standard NHL 200x85' | 'Olympic 200x100' | 'Small Sheet 185x80';

export interface Team {
  id: string;
  name: string;
  shortName: string;
  city: string;
  ageGroup: AgeGroup;
  tier: TierLevel;
  rating: number; // 60.0 to 99.9 (MYHockey Rankings scale)
  offenseRating: number; // 1 - 100
  defenseRating: number; // 1 - 100
  goalieName: string;
  goalieSavePct: number; // e.g. 0.918
  goalieGaa: number; // Goals against average, e.g. 2.15
  pimPerGame: number; // Average penalty minutes per game
  homeRink: string;
  rinkType: RinkType;
  primaryColor: string;
  secondaryColor: string;
  wins?: number;
  losses?: number;
  ties?: number;
}

export interface Game {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  rink: string;
  roundNumber?: number;
  notes?: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  scoreHome?: number;
  scoreAway?: number;
}

export interface ScoreProbability {
  home: number;
  away: number;
  probability: number;
}

export interface DifferentialProbability {
  diff: number; // e.g., -5, -4, ... 0, ... +4, +5
  probability: number;
}

export interface MatchupPrediction {
  homeTeam: Team;
  awayTeam: Team;
  expectedGoalsHome: number;
  expectedGoalsAway: number;
  expectedTotalGoals: number;
  goalSpread: number; // home - away
  homeWinPct: number;
  awayWinPct: number;
  tieOrOtPct: number;
  blowoutRiskPct: number; // Probability differential >= 5
  mercyRuleProbability: number; // Probability differential >= 6
  parityScore: number; // 0 - 100 (100 = perfectly matched)
  parityTier: 'Elite Parity (Grade A+)' | 'Competitive (Grade A)' | 'Moderate (Grade B)' | 'Uneven (Grade C)' | 'Severe Blowout Hazard (Grade F)';
  mostLikelyScores: ScoreProbability[];
  goalDifferentialDistribution: DifferentialProbability[];
  xGByPeriod: {
    home: [number, number, number];
    away: [number, number, number];
  };
  factorsBreakdown: {
    baseRatingDelta: number;
    homeIceBoost: number;
    rinkGeometryAdjustment: number;
    goaltendingDifferential: number;
    specialTeamsDiscipline: number;
  };
}

export interface TeamScheduleMetric {
  teamId: string;
  teamName: string;
  rating: number;
  gamesTotal: number;
  homeGames: number;
  awayGames: number;
  avgOpponentRating: number;
  sosDifficultyRank: number;
  expectedWins: number;
  expectedLosses: number;
  blowoutHazardGames: number;
  competitiveGames: number;
  restViolations: number; // games with < 4 hours rest between same-day starts
}

export interface ScheduleParityMetrics {
  parityScore: number; // 0 - 100
  totalGames: number;
  competitiveGamesCount: number; // xDiff <= 1.5
  competitivePct: number;
  moderateGamesCount: number; // 1.5 < xDiff <= 3.5
  blowoutRiskGamesCount: number; // xDiff >= 3.5 or blowoutRisk >= 25%
  blowoutRiskPct: number;
  avgGoalSpread: number;
  maxSosDisparity: number;
  sosStandardDeviation: number;
  teamsMetrics: TeamScheduleMetric[];
  highestParityGame?: { game: Game; homeTeam: Team; awayTeam: Team; spread: number };
  worstBlowoutGame?: { game: Game; homeTeam: Team; awayTeam: Team; spread: number };
}

export interface Division {
  id: string;
  name: string;
  ageGroup: AgeGroup;
  tier: TierLevel;
  seasonOrTournament: string;
  teams: Team[];
  games: Game[];
}
