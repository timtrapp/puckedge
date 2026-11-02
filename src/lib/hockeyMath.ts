import {
  Team,
  Game,
  MatchupPrediction,
  ScoreProbability,
  DifferentialProbability,
  ScheduleParityMetrics,
  TeamScheduleMetric,
} from '../types/hockey';

// Factorial memoization
const factorialCache: number[] = [1, 1];
function factorial(n: number): number {
  if (n < 0) return 1;
  if (factorialCache[n] !== undefined) return factorialCache[n];
  let res = factorialCache[factorialCache.length - 1];
  for (let i = factorialCache.length; i <= n; i++) {
    res *= i;
    factorialCache[i] = res;
  }
  return factorialCache[n];
}

// Poisson probability function P(k; lambda) = (lambda^k * e^-lambda) / k!
export function poisson(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

export interface CustomMatchupModifiers {
  homeGoalieInjured?: boolean;
  awayGoalieInjured?: boolean;
  awayTravelDistanceMiles?: number; // 0 to 500+
  neutralSite?: boolean;
  customHomePim?: number;
  customAwayPim?: number;
}

/**
 * Calculates youth hockey expected goals based on MYHockey rating delta,
 * offense/defense ratings, goaltending save percentage, discipline (PIMs),
 * rink sheet geometry, and home-ice advantage.
 */
export function calculateMatchupPrediction(
  homeTeam: Team,
  awayTeam: Team,
  modifiers: CustomMatchupModifiers = {}
): MatchupPrediction {
  const baseGoalsPerGame = 3.25;

  // 1. Rating delta impact (approx 0.35 goals per 1.0 rating pt in youth hockey)
  const ratingDelta = homeTeam.rating - awayTeam.rating;
  const ratingSpreadFactor = ratingDelta * 0.34;

  // 2. Offense & Defense synergy
  // 50 is baseline average. Scale -25 to +25 -> -0.75 to +0.75 goals
  const homeOffenseMod = ((homeTeam.offenseRating - 50) / 50) * 0.75;
  const awayDefenseMod = ((50 - awayTeam.defenseRating) / 50) * 0.75;
  const awayOffenseMod = ((awayTeam.offenseRating - 50) / 50) * 0.75;
  const homeDefenseMod = ((50 - homeTeam.defenseRating) / 50) * 0.75;

  // 3. Goaltending differential
  const baselineSavePct = 0.905;
  const homeEffectiveSavePct = modifiers.homeGoalieInjured
    ? Math.max(0.850, homeTeam.goalieSavePct - 0.035)
    : homeTeam.goalieSavePct;
  const awayEffectiveSavePct = modifiers.awayGoalieInjured
    ? Math.max(0.850, awayTeam.goalieSavePct - 0.035)
    : awayTeam.goalieSavePct;

  // Each 0.010 save pct delta changes expected goals by ~0.20
  const homeGoalieImpact = (baselineSavePct - homeEffectiveSavePct) * 20.0;
  const awayGoalieImpact = (baselineSavePct - awayEffectiveSavePct) * 20.0;

  // 4. Penalty minutes & Special teams discipline
  const homePim = modifiers.customHomePim ?? homeTeam.pimPerGame;
  const awayPim = modifiers.customAwayPim ?? awayTeam.pimPerGame;
  const homePimPenalty = ((homePim - 6.0) / 2.0) * 0.12;
  const awayPimPenalty = ((awayPim - 6.0) / 2.0) * 0.12;

  // 5. Rink geometry
  let rinkHomeBoost = 0;
  let rinkAwayBoost = 0;
  if (homeTeam.rinkType === 'Olympic 200x100') {
    // Olympic wide sheets benefit high offense teams
    rinkHomeBoost += 0.22;
    rinkAwayBoost += 0.15;
  } else if (homeTeam.rinkType === 'Small Sheet 185x80') {
    // Small sheets reduce open-ice goals
    rinkHomeBoost -= 0.20;
    rinkAwayBoost -= 0.25;
  }

  // 6. Home-ice advantage & Travel fatigue
  let homeIceAdvantage = modifiers.neutralSite ? 0 : 0.24;
  if (modifiers.awayTravelDistanceMiles && modifiers.awayTravelDistanceMiles > 150) {
    const travelFatigue = Math.min(0.35, (modifiers.awayTravelDistanceMiles / 400) * 0.35);
    homeIceAdvantage += travelFatigue;
  }

  // Calculate raw expected goals
  let expectedHome =
    baseGoalsPerGame +
    ratingSpreadFactor / 2 +
    homeOffenseMod +
    awayDefenseMod +
    awayGoalieImpact +
    awayPimPenalty +
    rinkHomeBoost +
    homeIceAdvantage;

  let expectedAway =
    baseGoalsPerGame -
    ratingSpreadFactor / 2 +
    awayOffenseMod +
    homeDefenseMod +
    homeGoalieImpact +
    homePimPenalty +
    rinkAwayBoost;

  // Floor safety at 0.40 goals minimum
  expectedHome = Math.max(0.4, expectedHome);
  expectedAway = Math.max(0.4, expectedAway);

  // Period-by-period xG modeling (Youth hockey: 1st period often tighter, 3rd period fatigue/empty nets)
  const xGByPeriod = {
    home: [
      parseFloat((expectedHome * 0.28).toFixed(2)),
      parseFloat((expectedHome * 0.34).toFixed(2)),
      parseFloat((expectedHome * 0.38).toFixed(2)),
    ] as [number, number, number],
    away: [
      parseFloat((expectedAway * 0.28).toFixed(2)),
      parseFloat((expectedAway * 0.34).toFixed(2)),
      parseFloat((expectedAway * 0.38).toFixed(2)),
    ] as [number, number, number],
  };

  // Matrix joint Poisson probabilities for score outcomes up to 10 goals
  const maxGoals = 10;
  const jointProbs: { [key: string]: number } = {};
  let totalProb = 0;

  for (let h = 0; h <= maxGoals; h++) {
    const probH = poisson(h, expectedHome);
    for (let a = 0; a <= maxGoals; a++) {
      const probA = poisson(a, expectedAway);
      const joint = probH * probA;
      jointProbs[`${h}-${a}`] = joint;
      totalProb += joint;
    }
  }

  // Normalize matrix
  for (const key of Object.keys(jointProbs)) {
    jointProbs[key] = jointProbs[key] / totalProb;
  }

  let rawHomeWins = 0;
  let rawAwayWins = 0;
  let rawTies = 0;
  let blowoutProb = 0; // diff >= 5
  let mercyRuleProb = 0; // diff >= 6

  // Differential distribution array (-7 to +7)
  const diffBuckets: { [diff: number]: number } = {};
  for (let d = -7; d <= 7; d++) {
    diffBuckets[d] = 0;
  }

  const scoresList: ScoreProbability[] = [];

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = jointProbs[`${h}-${a}`];
      scoresList.push({ home: h, away: a, probability: p });

      if (h > a) rawHomeWins += p;
      else if (a > h) rawAwayWins += p;
      else rawTies += p;

      const diff = h - a;
      if (Math.abs(diff) >= 5) blowoutProb += p;
      if (Math.abs(diff) >= 6) mercyRuleProb += p;

      const clampedDiff = Math.max(-7, Math.min(7, diff));
      diffBuckets[clampedDiff] = (diffBuckets[clampedDiff] || 0) + p;
    }
  }

  // Overtime allocation: In youth hockey, games that tie in regulation play 3v3 OT or shootout.
  // We allocate tie probability proportionally based on team ratings.
  const otWeightHome = homeTeam.rating / (homeTeam.rating + awayTeam.rating);
  const homeWinPct = (rawHomeWins + rawTies * otWeightHome) * 100;
  const awayWinPct = (rawAwayWins + rawTies * (1 - otWeightHome)) * 100;
  const tieOrOtPct = rawTies * 100;
  const blowoutRiskPct = blowoutProb * 100;
  const mercyRuleProbability = mercyRuleProb * 100;

  // Top 5 most likely exact scores
  scoresList.sort((a, b) => b.probability - a.probability);
  const mostLikelyScores = scoresList.slice(0, 6);

  // Goal differential distribution
  const goalDifferentialDistribution: DifferentialProbability[] = Object.keys(diffBuckets)
    .map(Number)
    .sort((a, b) => a - b)
    .map((d) => ({
      diff: d,
      probability: parseFloat((diffBuckets[d] * 100).toFixed(1)),
    }));

  // Parity Score (0 to 100)
  // Higher is better competitive balance. Severe blowout hazards drop score dramatically.
  const goalSpread = Math.abs(expectedHome - expectedAway);
  let parityScore = 100 - (blowoutRiskPct * 0.75 + goalSpread * 12.0);
  parityScore = Math.max(4, Math.min(99, Math.round(parityScore)));

  // Parity Tier Grading
  let parityTier: MatchupPrediction['parityTier'] = 'Moderate (Grade B)';
  if (parityScore >= 82) {
    parityTier = 'Elite Parity (Grade A+)';
  } else if (parityScore >= 68) {
    parityTier = 'Competitive (Grade A)';
  } else if (parityScore >= 48) {
    parityTier = 'Moderate (Grade B)';
  } else if (parityScore >= 28) {
    parityTier = 'Uneven (Grade C)';
  } else {
    parityTier = 'Severe Blowout Hazard (Grade F)';
  }

  return {
    homeTeam,
    awayTeam,
    expectedGoalsHome: parseFloat(expectedHome.toFixed(2)),
    expectedGoalsAway: parseFloat(expectedAway.toFixed(2)),
    expectedTotalGoals: parseFloat((expectedHome + expectedAway).toFixed(2)),
    goalSpread: parseFloat((expectedHome - expectedAway).toFixed(2)),
    homeWinPct: parseFloat(homeWinPct.toFixed(1)),
    awayWinPct: parseFloat(awayWinPct.toFixed(1)),
    tieOrOtPct: parseFloat(tieOrOtPct.toFixed(1)),
    blowoutRiskPct: parseFloat(blowoutRiskPct.toFixed(1)),
    mercyRuleProbability: parseFloat(mercyRuleProbability.toFixed(1)),
    parityScore,
    parityTier,
    mostLikelyScores,
    goalDifferentialDistribution,
    xGByPeriod,
    factorsBreakdown: {
      baseRatingDelta: parseFloat(ratingSpreadFactor.toFixed(2)),
      homeIceBoost: parseFloat(homeIceAdvantage.toFixed(2)),
      rinkGeometryAdjustment: parseFloat((rinkHomeBoost - rinkAwayBoost).toFixed(2)),
      goaltendingDifferential: parseFloat((awayGoalieImpact - homeGoalieImpact).toFixed(2)),
      specialTeamsDiscipline: parseFloat((awayPimPenalty - homePimPenalty).toFixed(2)),
    },
  };
}

/**
 * Calculates league or tournament schedule parity metrics:
 * - Strength of Schedule (SoS) per team and across the division
 * - Blowout hazard game count
 * - Rest interval parity & fatigue tracking
 * - Overall Schedule Parity Index (0-100)
 */
export function calculateScheduleParity(teams: Team[], games: Game[]): ScheduleParityMetrics {
  const teamMap = new Map<string, Team>();
  teams.forEach((t) => teamMap.set(t.id, t));

  const teamMetricsMap = new Map<
    string,
    {
      homeGames: number;
      awayGames: number;
      opponentsRatings: number[];
      expectedWins: number;
      expectedLosses: number;
      blowoutHazardGames: number;
      competitiveGames: number;
      gameDatesAndTimes: Array<{ date: string; time: string }>;
    }
  >();

  teams.forEach((t) => {
    teamMetricsMap.set(t.id, {
      homeGames: 0,
      awayGames: 0,
      opponentsRatings: [],
      expectedWins: 0,
      expectedLosses: 0,
      blowoutHazardGames: 0,
      competitiveGames: 0,
      gameDatesAndTimes: [],
    });
  });

  let competitiveGamesCount = 0;
  let moderateGamesCount = 0;
  let blowoutRiskGamesCount = 0;
  let sumGoalSpreads = 0;

  let highestParitySpread = 999;
  let highestParityGame: ScheduleParityMetrics['highestParityGame'] | undefined;
  let worstBlowoutSpread = -1;
  let worstBlowoutGame: ScheduleParityMetrics['worstBlowoutGame'] | undefined;

  games.forEach((game) => {
    const home = teamMap.get(game.homeTeamId);
    const away = teamMap.get(game.awayTeamId);
    if (!home || !away) return;

    const pred = calculateMatchupPrediction(home, away);
    const spread = Math.abs(pred.expectedGoalsHome - pred.expectedGoalsAway);
    sumGoalSpreads += spread;

    // Categorize game
    if (spread <= 1.4 && pred.blowoutRiskPct < 15) {
      competitiveGamesCount++;
    } else if (spread >= 3.4 || pred.blowoutRiskPct >= 28) {
      blowoutRiskGamesCount++;
    } else {
      moderateGamesCount++;
    }

    if (spread < highestParitySpread) {
      highestParitySpread = spread;
      highestParityGame = { game, homeTeam: home, awayTeam: away, spread };
    }
    if (spread > worstBlowoutSpread) {
      worstBlowoutSpread = spread;
      worstBlowoutGame = { game, homeTeam: home, awayTeam: away, spread };
    }

    // Update Home
    const hMetric = teamMetricsMap.get(home.id)!;
    hMetric.homeGames++;
    hMetric.opponentsRatings.push(away.rating);
    hMetric.expectedWins += pred.homeWinPct / 100;
    hMetric.expectedLosses += pred.awayWinPct / 100;
    hMetric.gameDatesAndTimes.push({ date: game.date, time: game.time });
    if (pred.blowoutRiskPct >= 25) hMetric.blowoutHazardGames++;
    if (spread <= 1.5) hMetric.competitiveGames++;

    // Update Away
    const aMetric = teamMetricsMap.get(away.id)!;
    aMetric.awayGames++;
    aMetric.opponentsRatings.push(home.rating);
    aMetric.expectedWins += pred.awayWinPct / 100;
    aMetric.expectedLosses += pred.homeWinPct / 100;
    aMetric.gameDatesAndTimes.push({ date: game.date, time: game.time });
    if (pred.blowoutRiskPct >= 25) aMetric.blowoutHazardGames++;
    if (spread <= 1.5) aMetric.competitiveGames++;
  });

  // Calculate team schedule metrics
  const teamsMetrics: TeamScheduleMetric[] = teams.map((team) => {
    const data = teamMetricsMap.get(team.id)!;
    const gamesTotal = data.homeGames + data.awayGames;
    const avgOpponentRating =
      data.opponentsRatings.length > 0
        ? data.opponentsRatings.reduce((sum, r) => sum + r, 0) / data.opponentsRatings.length
        : team.rating;

    // Check rest violations: same day games with < 3.5 hours between starts
    let restViolations = 0;
    const sortedTimes = [...data.gameDatesAndTimes].sort(
      (a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()
    );
    for (let i = 0; i < sortedTimes.length - 1; i++) {
      const g1 = new Date(`${sortedTimes[i].date}T${sortedTimes[i].time}`).getTime();
      const g2 = new Date(`${sortedTimes[i + 1].date}T${sortedTimes[i + 1].time}`).getTime();
      const diffHours = (g2 - g1) / (1000 * 60 * 60);
      if (diffHours > 0 && diffHours < 3.5) {
        restViolations++;
      }
    }

    return {
      teamId: team.id,
      teamName: team.name,
      rating: team.rating,
      gamesTotal,
      homeGames: data.homeGames,
      awayGames: data.awayGames,
      avgOpponentRating: parseFloat(avgOpponentRating.toFixed(2)),
      sosDifficultyRank: 1, // Will be computed below
      expectedWins: parseFloat(data.expectedWins.toFixed(1)),
      expectedLosses: parseFloat(data.expectedLosses.toFixed(1)),
      blowoutHazardGames: data.blowoutHazardGames,
      competitiveGames: data.competitiveGames,
      restViolations,
    };
  });

  // Rank teams by SoS difficulty (highest avgOpponentRating gets rank 1)
  teamsMetrics.sort((a, b) => b.avgOpponentRating - a.avgOpponentRating);
  teamsMetrics.forEach((tm, idx) => {
    tm.sosDifficultyRank = idx + 1;
  });

  const totalGames = games.length;
  const competitivePct = totalGames > 0 ? (competitiveGamesCount / totalGames) * 100 : 0;
  const blowoutRiskPct = totalGames > 0 ? (blowoutRiskGamesCount / totalGames) * 100 : 0;
  const avgGoalSpread = totalGames > 0 ? sumGoalSpreads / totalGames : 0;

  // Strength of Schedule variance across teams
  const sosValues = teamsMetrics.map((t) => t.avgOpponentRating);
  const minSos = sosValues.length > 0 ? Math.min(...sosValues) : 0;
  const maxSos = sosValues.length > 0 ? Math.max(...sosValues) : 0;
  const maxSosDisparity = maxSos - minSos;

  const avgSos = sosValues.reduce((a, b) => a + b, 0) / (sosValues.length || 1);
  const sosVariance =
    sosValues.reduce((sum, val) => sum + Math.pow(val - avgSos, 2), 0) / (sosValues.length || 1);
  const sosStandardDeviation = Math.sqrt(sosVariance);

  // Overall Parity Score Calculation (0 to 100):
  // 100 = Every team has equal SoS, minimal blowouts, high competitive ratio
  let parityScore = 100;
  // Penalty for blowout games percentage
  parityScore -= blowoutRiskPct * 0.45;
  // Penalty for high SoS disparity across teams (e.g. 3 rating pts delta = -12 pts)
  parityScore -= maxSosDisparity * 4.2;
  // Penalty for average goal spread
  parityScore -= (avgGoalSpread - 1.2) * 8.0;
  // Bonus for high competitive percentage
  parityScore += (competitivePct - 40) * 0.2;

  parityScore = Math.max(10, Math.min(99, Math.round(parityScore)));

  return {
    parityScore,
    totalGames,
    competitiveGamesCount,
    competitivePct: parseFloat(competitivePct.toFixed(1)),
    moderateGamesCount,
    blowoutRiskGamesCount,
    blowoutRiskPct: parseFloat(blowoutRiskPct.toFixed(1)),
    avgGoalSpread: parseFloat(avgGoalSpread.toFixed(2)),
    maxSosDisparity: parseFloat(maxSosDisparity.toFixed(2)),
    sosStandardDeviation: parseFloat(sosStandardDeviation.toFixed(2)),
    teamsMetrics,
    highestParityGame,
    worstBlowoutGame,
  };
}

/**
 * Schedule Optimizer:
 * Identifies high-blowout fixtures and attempts to swap away opponents within
 * the schedule to equalize Strength of Schedule and minimize lopsided blowouts.
 */
export function optimizeScheduleParity(
  teams: Team[],
  games: Game[]
): {
  optimizedGames: Game[];
  swapsCount: number;
  initialParityScore: number;
  newParityScore: number;
  improvement: number;
} {
  const initialMetrics = calculateScheduleParity(teams, games);
  let bestGames = [...games.map((g) => ({ ...g }))];
  let bestScore = initialMetrics.parityScore;
  let swapsCount = 0;

  // Clone games to work on
  const candidateGames = [...bestGames];

  // Try up to 100 potential pairwise away team swaps
  for (let i = 0; i < candidateGames.length; i++) {
    for (let j = i + 1; j < candidateGames.length; j++) {
      const g1 = candidateGames[i];
      const g2 = candidateGames[j];

      // Do not swap if it creates a team playing itself
      if (
        g1.homeTeamId === g2.awayTeamId ||
        g2.homeTeamId === g1.awayTeamId ||
        g1.homeTeamId === g2.homeTeamId
      ) {
        continue;
      }

      // Propose swap of away teams
      const originalAway1 = g1.awayTeamId;
      const originalAway2 = g2.awayTeamId;

      g1.awayTeamId = originalAway2;
      g2.awayTeamId = originalAway1;

      const evalMetrics = calculateScheduleParity(teams, candidateGames);

      if (evalMetrics.parityScore > bestScore) {
        bestScore = evalMetrics.parityScore;
        bestGames = [...candidateGames.map((g) => ({ ...g }))];
        swapsCount++;
      } else {
        // Revert swap
        g1.awayTeamId = originalAway1;
        g2.awayTeamId = originalAway2;
      }
    }
  }

  return {
    optimizedGames: bestGames,
    swapsCount,
    initialParityScore: initialMetrics.parityScore,
    newParityScore: bestScore,
    improvement: bestScore - initialMetrics.parityScore,
  };
}

/**
 * Schedule Generator:
 * Generates either a Balanced Round Robin, Tiered Pod Crossover, or Swiss Parity Pairings
 */
export function generateScheduleForTeams(
  teams: Team[],
  mode: 'round_robin' | 'tiered_flight' | 'swiss_parity',
  startDateStr: string = '2026-11-07',
  gamesPerTeamTarget: number = 4
): Game[] {
  if (teams.length < 2) return [];

  const generatedGames: Game[] = [];
  const baseDate = new Date(startDateStr);
  let gameIdCounter = 1;

  if (mode === 'round_robin') {
    // Standard round-robin scheduling (Berger tables / polygon method)
    const n = teams.length;
    const teamList = [...teams];
    const isOdd = n % 2 !== 0;
    if (isOdd) {
      teamList.push({ id: '__bye__', name: 'BYE' } as any);
    }
    const numTeams = teamList.length;
    const rounds = numTeams - 1;
    const half = numTeams / 2;

    for (let r = 0; r < rounds; r++) {
      const gameDay = new Date(baseDate);
      gameDay.setDate(baseDate.getDate() + r * 7); // weekly rounds
      const dateStr = gameDay.toISOString().split('T')[0];

      for (let i = 0; i < half; i++) {
        const homeIdx = (r + i) % (numTeams - 1);
        let awayIdx = (numTeams - 1 - i + r) % (numTeams - 1);
        if (i === 0) awayIdx = numTeams - 1;

        const home = teamList[homeIdx];
        const away = teamList[awayIdx];

        if (home.id === '__bye__' || away.id === '__bye__') continue;

        // Alternate home and away to prevent imbalance
        const isAlternate = (r + i) % 2 === 1;
        const actualHome = isAlternate ? away : home;
        const actualAway = isAlternate ? home : away;

        const hour = 10 + (i % 5) * 2; // 10:00, 12:00, 14:00, 16:00, 18:00
        const timeStr = `${hour < 10 ? '0' + hour : hour}:00`;

        generatedGames.push({
          id: `gen-rr-${gameIdCounter++}`,
          homeTeamId: actualHome.id,
          awayTeamId: actualAway.id,
          date: dateStr,
          time: timeStr,
          rink: `${actualHome.homeRink || 'Main Arena'} - Rink 1`,
          roundNumber: r + 1,
          status: 'scheduled',
        });
      }
    }
  } else if (mode === 'tiered_flight') {
    // Sort by rating: upper half is Flight A, lower half is Flight B
    const sorted = [...teams].sort((a, b) => b.rating - a.rating);
    const mid = Math.ceil(sorted.length / 2);
    const flightA = sorted.slice(0, mid);
    const flightB = sorted.slice(mid);

    let roundCounter = 1;

    // Internal flight matches (High parity)
    const scheduleFlight = (flight: Team[], flightName: string) => {
      for (let i = 0; i < flight.length; i++) {
        for (let j = i + 1; j < flight.length; j++) {
          const gameDay = new Date(baseDate);
          gameDay.setDate(baseDate.getDate() + (roundCounter % 4) * 7);
          const dateStr = gameDay.toISOString().split('T')[0];
          const hour = 11 + ((i + j) % 4) * 2;

          generatedGames.push({
            id: `gen-flight-${gameIdCounter++}`,
            homeTeamId: flight[i].id,
            awayTeamId: flight[j].id,
            date: dateStr,
            time: `${hour}:30`,
            rink: `${flight[i].homeRink || 'Metro Ice'} - Pad A`,
            roundNumber: roundCounter,
            notes: `${flightName} Divisional Play`,
            status: 'scheduled',
          });
          roundCounter++;
        }
      }
    };

    scheduleFlight(flightA, 'Flight A (Championship Tier)');
    scheduleFlight(flightB, 'Flight B (Contender Tier)');

    // Controlled adjacent crossover (e.g. Flight A bottom vs Flight B top)
    if (flightA.length > 0 && flightB.length > 0) {
      const aBottom = flightA[flightA.length - 1];
      const bTop = flightB[0];
      const crossoverDate = new Date(baseDate);
      crossoverDate.setDate(baseDate.getDate() + 28);
      generatedGames.push({
        id: `gen-crossover-${gameIdCounter++}`,
        homeTeamId: aBottom.id,
        awayTeamId: bTop.id,
        date: crossoverDate.toISOString().split('T')[0],
        time: '14:00',
        rink: 'Neutral Showcase Rink',
        roundNumber: 5,
        notes: 'Parity Crossover Showcase Game',
        status: 'scheduled',
      });
    }
  } else {
    // Swiss Parity: Pair teams with closest rating
    const sorted = [...teams].sort((a, b) => b.rating - a.rating);
    const rounds = Math.min(gamesPerTeamTarget, 4);

    for (let r = 0; r < rounds; r++) {
      const gameDay = new Date(baseDate);
      gameDay.setDate(baseDate.getDate() + r * 7);
      const dateStr = gameDay.toISOString().split('T')[0];

      for (let i = 0; i < sorted.length - 1; i += 2) {
        const t1 = sorted[i];
        const t2 = sorted[i + 1];
        if (!t1 || !t2) continue;

        const isEvenRound = r % 2 === 0;
        const home = isEvenRound ? t1 : t2;
        const away = isEvenRound ? t2 : t1;
        const hour = 10 + ((i / 2) % 4) * 2;

        generatedGames.push({
          id: `gen-swiss-${gameIdCounter++}`,
          homeTeamId: home.id,
          awayTeamId: away.id,
          date: dateStr,
          time: `${hour}:00`,
          rink: `${home.homeRink || 'Regional Ice Center'}`,
          roundNumber: r + 1,
          notes: `Swiss Parity Pairing (Rating Spread: ${Math.abs(t1.rating - t2.rating).toFixed(1)} pts)`,
          status: 'scheduled',
        });
      }
    }
  }

  return generatedGames;
}
