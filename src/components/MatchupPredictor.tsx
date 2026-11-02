import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Sparkles,
  Info,
  Clock,
  Compass,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { Team, MatchupPrediction } from '../types/hockey';
import {
  calculateMatchupPrediction,
  CustomMatchupModifiers,
} from '../lib/hockeyMath';

interface MatchupPredictorProps {
  teams: Team[];
  initialHomeTeamId?: string;
  initialAwayTeamId?: string;
}

export const MatchupPredictor: React.FC<MatchupPredictorProps> = ({
  teams,
  initialHomeTeamId,
  initialAwayTeamId,
}) => {
  const [homeTeamId, setHomeTeamId] = useState<string>(
    initialHomeTeamId || (teams[0] ? teams[0].id : '')
  );
  const [awayTeamId, setAwayTeamId] = useState<string>(
    initialAwayTeamId || (teams[1] ? teams[1].id : '')
  );

  // Modifiers
  const [neutralSite, setNeutralSite] = useState<boolean>(false);
  const [awayTravelMiles, setAwayTravelMiles] = useState<number>(0);
  const [homeGoalieInjured, setHomeGoalieInjured] = useState<boolean>(false);
  const [awayGoalieInjured, setAwayGoalieInjured] = useState<boolean>(false);
  const [customHomePim, setCustomHomePim] = useState<number | undefined>(undefined);
  const [customAwayPim, setCustomAwayPim] = useState<number | undefined>(undefined);
  const [showModifiers, setShowModifiers] = useState<boolean>(false);

  // AI Scouting state
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiReport, setAiReport] = useState<{
    tacticalBreakdown: string;
    keysToWinHome: string[];
    keysToWinAway: string[];
    blowoutPreventionTip: string;
    isAiGenerated: boolean;
  } | null>(null);

  const homeTeam = useMemo(
    () => teams.find((t) => t.id === homeTeamId) || teams[0],
    [teams, homeTeamId]
  );
  const awayTeam = useMemo(
    () => teams.find((t) => t.id === awayTeamId) || teams[1] || teams[0],
    [teams, awayTeamId]
  );

  const modifiers: CustomMatchupModifiers = useMemo(
    () => ({
      neutralSite,
      awayTravelDistanceMiles: awayTravelMiles,
      homeGoalieInjured,
      awayGoalieInjured,
      customHomePim,
      customAwayPim,
    }),
    [
      neutralSite,
      awayTravelMiles,
      homeGoalieInjured,
      awayGoalieInjured,
      customHomePim,
      customAwayPim,
    ]
  );

  const prediction: MatchupPrediction | null = useMemo(() => {
    if (!homeTeam || !awayTeam || homeTeam.id === awayTeam.id) return null;
    return calculateMatchupPrediction(homeTeam, awayTeam, modifiers);
  }, [homeTeam, awayTeam, modifiers]);

  const handleSwapTeams = () => {
    const temp = homeTeamId;
    setHomeTeamId(awayTeamId);
    setAwayTeamId(temp);
    setAiReport(null);
  };

  const handleGenerateAiReport = async () => {
    if (!prediction || !homeTeam || !awayTeam) return;
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/matchup-scouting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam,
          awayTeam,
          prediction,
          customFactors: {
            neutralSite,
            awayTravelMiles,
            homeGoalieInjured,
            awayGoalieInjured,
          },
        }),
      });
      const data = await res.json();
      setAiReport(data);
    } catch (err) {
      console.error('Failed to fetch AI scouting:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  if (teams.length < 2) {
    return (
      <div className="p-8 text-center text-slate-400">
        Please add at least 2 teams to the division to run matchup predictions.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Selection Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Home Team Selector */}
          <div className="w-full lg:w-5/12 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-blue-400 tracking-wider">HOME TEAM</span>
              <span>{homeTeam?.city}</span>
            </div>
            <div className="relative">
              <select
                aria-label="Select Home Team"
                value={homeTeamId}
                onChange={(e) => {
                  setHomeTeamId(e.target.value);
                  setAiReport(null);
                }}
                className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-lg px-4 py-2.5 text-base font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === awayTeamId}>
                    {t.name} (Rating: {t.rating.toFixed(1)})
                  </option>
                ))}
              </select>
            </div>
            {homeTeam && (
              <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                <span>Offense: <strong className="text-slate-200 tabular-nums">{homeTeam.offenseRating}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Defense: <strong className="text-slate-200 tabular-nums">{homeTeam.defenseRating}</strong></span>
                <span aria-hidden="true">·</span>
                <span>SV%: <strong className="text-slate-200 tabular-nums">.{Math.round(homeTeam.goalieSavePct * 1000)}</strong></span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{homeTeam.rinkType}</span>
              </div>
            )}
          </div>

          {/* Swap Button */}
          <div className="shrink-0 flex flex-col items-center justify-center">
            <button
              onClick={handleSwapTeams}
              title="Swap Home and Away"
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full border border-slate-700 transition-all hover:scale-105 active:scale-95"
            >
              <ArrowRightLeft className="w-5 h-5" />
            </button>
            <span className="text-[11px] text-slate-500 mt-1">VS</span>
          </div>

          {/* Away Team Selector */}
          <div className="w-full lg:w-5/12 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-amber-400 tracking-wider">AWAY TEAM</span>
              <span>{awayTeam?.city}</span>
            </div>
            <div className="relative">
              <select
                aria-label="Select Away Team"
                value={awayTeamId}
                onChange={(e) => {
                  setAwayTeamId(e.target.value);
                  setAiReport(null);
                }}
                className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-lg px-4 py-2.5 text-base font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === homeTeamId}>
                    {t.name} (Rating: {t.rating.toFixed(1)})
                  </option>
                ))}
              </select>
            </div>
            {awayTeam && (
              <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                <span>Offense: <strong className="text-slate-200 tabular-nums">{awayTeam.offenseRating}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Defense: <strong className="text-slate-200 tabular-nums">{awayTeam.defenseRating}</strong></span>
                <span aria-hidden="true">·</span>
                <span>SV%: <strong className="text-slate-200 tabular-nums">.{Math.round(awayTeam.goalieSavePct * 1000)}</strong></span>
                <span aria-hidden="true">·</span>
                <span>PIM: <strong className="text-slate-200 tabular-nums">{awayTeam.pimPerGame}m</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Toggle What-If Modifiers Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => setShowModifiers(!showModifiers)}
            className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>{showModifiers ? 'Hide Matchup Adjusters & Scenarios' : 'Tune "What-If" Game Factors (Travel, Goalie, Penalties)'}</span>
          </button>

          <span className="text-xs text-slate-500 tabular-nums">
            Rating Spread: <strong className="text-slate-300">{Math.abs((homeTeam?.rating || 0) - (awayTeam?.rating || 0)).toFixed(1)} pts</strong>
          </span>
        </div>

        {/* Collapsible Modifiers Drawer */}
        {showModifiers && (
          <div className="mt-4 p-4 bg-slate-950/70 border border-slate-800/80 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-2">
              <label className="font-semibold text-slate-300 block">Venue & Travel</label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={neutralSite}
                  onChange={(e) => setNeutralSite(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>Neutral Tournament Site (no home boost)</span>
              </label>

              <div className="pt-2">
                <div className="flex justify-between text-slate-400">
                  <span>Away Travel Distance</span>
                  <span className="tabular-nums font-semibold text-slate-200">{awayTravelMiles} mi</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="25"
                  value={awayTravelMiles}
                  onChange={(e) => setAwayTravelMiles(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-semibold text-slate-300 block">Goaltending Health</label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={homeGoalieInjured}
                  onChange={(e) => setHomeGoalieInjured(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>Home Starter Rested / Backup Playing (-0.035 SV%)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={awayGoalieInjured}
                  onChange={(e) => setAwayGoalieInjured(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>Away Starter Rested / Backup Playing (-0.035 SV%)</span>
              </label>
            </div>

            <div className="space-y-2">
              <label className="font-semibold text-slate-300 block">Penalty Discipline</label>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Home PIMs:</span>
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="2"
                  placeholder={`${homeTeam?.pimPerGame || 6}m`}
                  value={customHomePim ?? ''}
                  onChange={(e) =>
                    setCustomHomePim(e.target.value === '' ? undefined : parseFloat(e.target.value))
                  }
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-slate-200 font-mono text-xs"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Away PIMs:</span>
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="2"
                  placeholder={`${awayTeam?.pimPerGame || 6}m`}
                  value={customAwayPim ?? ''}
                  onChange={(e) =>
                    setCustomAwayPim(e.target.value === '' ? undefined : parseFloat(e.target.value))
                  }
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-slate-200 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {prediction && (
        <>
          {/* Main Prediction Scoreboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Projected Score & Win Probability (2 Cols) */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  Expected Outcome & Win Probabilities
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Poisson Simulation (1,000 Iterations)
                </span>
              </div>

              {/* Big Score Display */}
              <div className="grid grid-cols-3 items-center text-center py-2">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-blue-400 truncate block">
                    {homeTeam.name}
                  </span>
                  <div className="text-4xl sm:text-5xl font-bold font-mono tracking-tight text-white tabular-nums">
                    {prediction.expectedGoalsHome.toFixed(1)}
                  </div>
                  <span className="text-xs text-slate-400">Expected Goals</span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-mono">PROGNOSTIC</span>
                  <div className="text-2xl font-bold text-slate-400 font-mono">VS</div>
                  <span className="text-xs text-slate-400 tabular-nums">
                    Total: {prediction.expectedTotalGoals.toFixed(1)} xG
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-semibold text-amber-400 truncate block">
                    {awayTeam.name}
                  </span>
                  <div className="text-4xl sm:text-5xl font-bold font-mono tracking-tight text-white tabular-nums">
                    {prediction.expectedGoalsAway.toFixed(1)}
                  </div>
                  <span className="text-xs text-slate-400">Expected Goals</span>
                </div>
              </div>

              {/* Multi-segment Win Probability Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-blue-400">
                    {homeTeam.shortName} {prediction.homeWinPct.toFixed(1)}%
                  </span>
                  <span className="text-slate-400">
                    OT/SO {prediction.tieOrOtPct.toFixed(1)}%
                  </span>
                  <span className="text-amber-400">
                    {awayTeam.shortName} {prediction.awayWinPct.toFixed(1)}%
                  </span>
                </div>

                <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex p-0.5 border border-slate-800">
                  <div
                    style={{ width: `${prediction.homeWinPct}%` }}
                    className="h-full bg-blue-600 rounded-l-full transition-all duration-500"
                    title={`Home Win: ${prediction.homeWinPct}%`}
                  />
                  <div
                    style={{ width: `${prediction.tieOrOtPct}%` }}
                    className="h-full bg-slate-600 transition-all duration-500"
                    title={`Overtime / Shootout: ${prediction.tieOrOtPct}%`}
                  />
                  <div
                    style={{ width: `${prediction.awayWinPct}%` }}
                    className="h-full bg-amber-600 rounded-r-full transition-all duration-500"
                    title={`Away Win: ${prediction.awayWinPct}%`}
                  />
                </div>
              </div>

              {/* Period-by-Period Projected Goals */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-xs font-medium text-slate-400 block mb-2">
                  Projected xG by Period (15-min Youth Intervals)
                </span>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[11px]">1st Period</span>
                    <span className="font-mono font-semibold text-slate-200 tabular-nums">
                      {prediction.xGByPeriod.home[0]} - {prediction.xGByPeriod.away[0]}
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[11px]">2nd Period</span>
                    <span className="font-mono font-semibold text-slate-200 tabular-nums">
                      {prediction.xGByPeriod.home[1]} - {prediction.xGByPeriod.away[1]}
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[11px]">3rd Period</span>
                    <span className="font-mono font-semibold text-slate-200 tabular-nums">
                      {prediction.xGByPeriod.home[2]} - {prediction.xGByPeriod.away[2]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Most Likely Final Scores Grid */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-xs font-medium text-slate-400 block mb-2">
                  Highest Probability Final Scores
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {prediction.mostLikelyScores.map((s, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/80 border border-slate-800 p-2 rounded text-center"
                    >
                      <div className="text-sm font-bold font-mono text-white tabular-nums">
                        {s.home} - {s.away}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {(s.probability * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Parity & Blowout Risk Card (1 Col) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Parity & Blowout Risk
                  </h3>
                  <span className="text-xs text-slate-400">USA Hockey</span>
                </div>

                {/* Parity Score & Grade */}
                <div className="mt-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Matchup Parity Index</span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-4xl font-extrabold font-mono text-white tabular-nums">
                      {prediction.parityScore}
                    </span>
                    <span className="text-xs text-slate-500">/ 100</span>
                  </div>
                  <div className="pt-1">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md inline-block ${
                        prediction.parityScore >= 75
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                          : prediction.parityScore >= 50
                          ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                          : prediction.parityScore >= 30
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                      }`}
                    >
                      {prediction.parityTier}
                    </span>
                  </div>
                </div>

                {/* Blowout Risk Gauge */}
                <div className="mt-4 space-y-3">
                  <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-medium flex items-center gap-1.5">
                        <AlertTriangle
                          className={`w-3.5 h-3.5 ${
                            prediction.blowoutRiskPct >= 35 ? 'text-rose-400' : 'text-amber-400'
                          }`}
                        />
                        Blowout Hazard (5+ Spread)
                      </span>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          prediction.blowoutRiskPct >= 35 ? 'text-rose-400' : 'text-slate-300'
                        }`}
                      >
                        {prediction.blowoutRiskPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, prediction.blowoutRiskPct)}%` }}
                        className={`h-full rounded-full ${
                          prediction.blowoutRiskPct >= 35
                            ? 'bg-rose-500'
                            : prediction.blowoutRiskPct >= 20
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 pt-0.5">
                      {prediction.blowoutRiskPct < 15
                        ? 'Low blowout probability. High developmental ice time for both squads.'
                        : prediction.blowoutRiskPct < 35
                        ? 'Moderate blowout hazard. First period scoring pace will determine contest flow.'
                        : 'Severe blowout warning! Running clock or mercy rule hazard (>5 goals).'}
                    </p>
                  </div>

                  {/* Mercy Rule Probability */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-950/40 rounded-lg border border-slate-800/60 text-xs">
                    <span className="text-slate-400">Mercy Rule Risk (6+ Spread):</span>
                    <span className="font-mono font-semibold text-slate-200 tabular-nums">
                      {prediction.mercyRuleProbability.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Factor Decomposition */}
              <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Model Factor Influences
                </span>
                <div className="flex justify-between text-slate-400">
                  <span>Rating Spread:</span>
                  <span className="font-mono text-slate-200 tabular-nums">
                    {prediction.factorsBreakdown.baseRatingDelta > 0 ? '+' : ''}
                    {prediction.factorsBreakdown.baseRatingDelta.toFixed(2)} goals
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Goaltending Advantage:</span>
                  <span className="font-mono text-slate-200 tabular-nums">
                    {prediction.factorsBreakdown.goaltendingDifferential > 0 ? '+' : ''}
                    {prediction.factorsBreakdown.goaltendingDifferential.toFixed(2)} goals
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Home Rink / Sheet:</span>
                  <span className="font-mono text-slate-200 tabular-nums">
                    +{prediction.factorsBreakdown.homeIceBoost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Goal Differential Distribution Histogram */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Goal Differential Probability Distribution
                </h3>
                <p className="text-xs text-slate-400">
                  Spread frequency from -7 (Away Blowout) to 0 (Tied Regulation) to +7 (Home Blowout).
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
                  {homeTeam.shortName} Win
                </span>
                <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-500 inline-block" />
                  Tied
                </span>
                <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                  {awayTeam.shortName} Win
                </span>
              </div>
            </div>

            {/* Bars container */}
            <div className="grid grid-cols-15 gap-1 sm:gap-2 items-end h-44 pt-4 px-2">
              {prediction.goalDifferentialDistribution.map((item) => {
                const isHome = item.diff > 0;
                const isAway = item.diff < 0;
                const isTie = item.diff === 0;
                const isBlowout = Math.abs(item.diff) >= 5;
                const maxProb = Math.max(
                  ...prediction.goalDifferentialDistribution.map((d) => d.probability),
                  1
                );
                const heightPct = Math.max(4, (item.probability / maxProb) * 100);

                return (
                  <div key={item.diff} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.probability}%
                    </span>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t transition-all ${
                        isBlowout
                          ? isHome
                            ? 'bg-rose-500/80 hover:bg-rose-400'
                            : 'bg-rose-500/80 hover:bg-rose-400'
                          : isHome
                          ? 'bg-blue-600 hover:bg-blue-500'
                          : isAway
                          ? 'bg-amber-600 hover:bg-amber-500'
                          : 'bg-slate-600 hover:bg-slate-500'
                      }`}
                    />
                    <span className="text-[10px] font-mono text-slate-400 font-semibold tabular-nums">
                      {item.diff > 0 ? `+${item.diff}` : item.diff}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-center text-[11px] text-slate-500">
              Center zone (0, ±1, ±2) represents optimal competitive parity with balanced player development.
            </div>
          </div>

          {/* AI Coach & Tournament Director Scouting Report */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  Tactical Scouting & Parity Advisory
                </h3>
                <p className="text-xs text-slate-400">
                  Master Coach analysis on systems, goalie tracking, and tournament parity management.
                </p>
              </div>

              <button
                onClick={handleGenerateAiReport}
                disabled={isAiLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/60 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm shadow-blue-500/20"
              >
                {isAiLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Analyzing Systems...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{aiReport ? 'Regenerate Scouting Report' : 'Generate Scouting Report'}</span>
                  </>
                )}
              </button>
            </div>

            {aiReport ? (
              <div className="mt-4 space-y-4 pt-3 border-t border-slate-800">
                <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
                  {aiReport.tacticalBreakdown}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block">
                      Keys to Victory: {homeTeam.name}
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {aiReport.keysToWinHome.map((k, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                          <span>{k}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
                      Keys to Victory: {awayTeam.name}
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {aiReport.keysToWinAway.map((k, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{k}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-3 bg-blue-950/30 border border-blue-900/50 rounded-lg flex items-start gap-2.5 text-xs text-blue-200">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block text-blue-300">
                      Tournament Director Advisory:
                    </strong>
                    <span>{aiReport.blowoutPreventionTip}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 flex items-center justify-between">
                <span>Click "Generate Scouting Report" to synthesize AI tactical keys and game mitigation strategies for this matchup.</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
