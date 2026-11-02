import React, { useState, useMemo } from 'react';
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRightLeft,
  Calendar,
  Clock,
  Info,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { Division, Team, Game, ScheduleParityMetrics } from '../types/hockey';
import {
  calculateScheduleParity,
  optimizeScheduleParity,
} from '../lib/hockeyMath';

interface ParityCalculatorProps {
  division: Division;
  onUpdateGames: (newGames: Game[]) => void;
  onSelectMatchupForPreview?: (homeId: string, awayId: string) => void;
}

export const ParityCalculator: React.FC<ParityCalculatorProps> = ({
  division,
  onUpdateGames,
  onSelectMatchupForPreview,
}) => {
  const [sortField, setSortField] = useState<
    'sos' | 'rating' | 'expectedWins' | 'blowouts' | 'rest'
  >('sos');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Optimization state
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizationResult, setOptimizationResult] = useState<{
    swapsCount: number;
    initialScore: number;
    newScore: number;
    improvement: number;
    optimizedGames: Game[];
  } | null>(null);

  // AI Commissioner Advisory state
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiAdvisory, setAiAdvisory] = useState<{
    summary: string;
    recommendations: string[];
    swapSuggestions: string;
    isAiGenerated: boolean;
  } | null>(null);

  const metrics: ScheduleParityMetrics = useMemo(() => {
    return calculateScheduleParity(division.teams, division.games);
  }, [division.teams, division.games]);

  const sortedTeamMetrics = useMemo(() => {
    const list = [...metrics.teamsMetrics];
    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortField === 'sos') {
        valA = a.avgOpponentRating;
        valB = b.avgOpponentRating;
      } else if (sortField === 'rating') {
        valA = a.rating;
        valB = b.rating;
      } else if (sortField === 'expectedWins') {
        valA = a.expectedWins;
        valB = b.expectedWins;
      } else if (sortField === 'blowouts') {
        valA = a.blowoutHazardGames;
        valB = b.blowoutHazardGames;
      } else if (sortField === 'rest') {
        valA = a.restViolations;
        valB = b.restViolations;
      }
      return sortAsc ? valA - valB : valB - valA;
    });
    return list;
  }, [metrics.teamsMetrics, sortField, sortAsc]);

  const handleRunOptimizer = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      const res = optimizeScheduleParity(division.teams, division.games);
      setOptimizationResult({
        swapsCount: res.swapsCount,
        initialScore: res.initialParityScore,
        newScore: res.newParityScore,
        improvement: res.improvement,
        optimizedGames: res.optimizedGames,
      });
      setIsOptimizing(false);
    }, 400);
  };

  const handleApplyOptimizedSchedule = () => {
    if (!optimizationResult) return;
    onUpdateGames(optimizationResult.optimizedGames);
    setOptimizationResult(null);
  };

  const handleRequestAiAdvisory = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/schedule-parity-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleSummary: {
            parityScore: metrics.parityScore,
            totalGames: metrics.totalGames,
            blowoutRiskGamesCount: metrics.blowoutRiskGamesCount,
            blowoutRiskPct: metrics.blowoutRiskPct,
            competitiveGamesCount: metrics.competitiveGamesCount,
            competitivePct: metrics.competitivePct,
            maxSosDisparity: metrics.maxSosDisparity,
          },
          teamMetrics: metrics.teamsMetrics.map((t) => ({
            name: t.teamName,
            rating: t.rating,
            sos: t.avgOpponentRating,
            expectedWins: t.expectedWins,
            blowoutGames: t.blowoutHazardGames,
          })),
        }),
      });
      const data = await res.json();
      setAiAdvisory(data);
    } catch (err) {
      console.error('Failed to get AI advisory:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Parity Dashboard Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Parity Index Gauge */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-slate-300">
              Schedule Parity Index
            </span>
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono text-white tabular-nums">
              {metrics.parityScore}
            </span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
            <span>
              {metrics.parityScore >= 80
                ? 'Excellent Balance'
                : metrics.parityScore >= 60
                ? 'Acceptable Parity'
                : 'Uneven Schedule'}
            </span>
            <span className="text-slate-500 tabular-nums">{metrics.totalGames} Games</span>
          </div>
        </div>

        {/* Blowout Hazard Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-slate-300">
              Blowout Hazard Games
            </span>
            <AlertTriangle
              className={`w-4 h-4 ${
                metrics.blowoutRiskPct > 20 ? 'text-rose-400' : 'text-slate-400'
              }`}
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-4xl font-extrabold font-mono tabular-nums ${
                metrics.blowoutRiskGamesCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {metrics.blowoutRiskGamesCount}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              ({metrics.blowoutRiskPct.toFixed(1)}%)
            </span>
          </div>
          <div className="text-xs text-slate-400 pt-1">
            Expected goal spread $\ge 3.5$ or $>25\%$ blowout risk
          </div>
        </div>

        {/* Competitive Matchups */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-slate-300">
              High Parity Matchups
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono text-emerald-400 tabular-nums">
              {metrics.competitiveGamesCount}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              ({metrics.competitivePct.toFixed(1)}%)
            </span>
          </div>
          <div className="text-xs text-slate-400 pt-1">
            Expected $\le 1.4$ goal spread (one-goal contests)
          </div>
        </div>

        {/* SoS Max Disparity */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-slate-300">
              Max SoS Disparity
            </span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono text-white tabular-nums">
              {metrics.maxSosDisparity.toFixed(1)}
            </span>
            <span className="text-xs text-slate-500 font-mono">pts</span>
          </div>
          <div className="text-xs text-slate-400 pt-1">
            Spread between hardest & softest schedules (target &lt; 2.0)
          </div>
        </div>
      </div>

      {/* Optimizer Action Banner */}
      <div className="bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-900/40 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              Algorithmic Parity Optimizer & Fixture Rebalancer
            </h3>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Simulates permutations across scheduled rounds to eliminate severe blowout games and equalize Strength of Schedule (SoS) across all teams without altering game counts.
          </p>
        </div>

        <button
          onClick={handleRunOptimizer}
          disabled={isOptimizing || division.games.length < 3}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm shadow-blue-500/20"
        >
          {isOptimizing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Simulating Optimal Swaps...</span>
            </>
          ) : (
            <>
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Auto-Optimize Schedule Parity</span>
            </>
          )}
        </button>
      </div>

      {/* Optimization Result Alert Modal / Card */}
      {optimizationResult && (
        <div className="bg-slate-900 border border-blue-500/40 rounded-xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">
                Optimization Simulation Complete
              </h4>
            </div>
            <button
              onClick={() => setOptimizationResult(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 block">Initial Parity Score</span>
              <span className="text-2xl font-bold font-mono text-slate-300 tabular-nums">
                {optimizationResult.initialScore}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 block">Optimized Score</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                {optimizationResult.newScore}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 block">Rebalanced Fixtures</span>
              <span className="text-2xl font-bold font-mono text-blue-400 tabular-nums">
                {optimizationResult.swapsCount} Swaps
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setOptimizationResult(null)}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyOptimizedSchedule}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm shadow-emerald-600/20"
            >
              Apply Rebalanced Schedule
            </button>
          </div>
        </div>
      )}

      {/* Parity Extremes (Best Matchup vs Worst Blowout) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.highestParityGame && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                HIGHEST PARITY MATCHUP
              </span>
              <span className="font-mono">{metrics.highestParityGame.game.date}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">
                {metrics.highestParityGame.homeTeam.name} vs{' '}
                {metrics.highestParityGame.awayTeam.name}
              </span>
              <span className="text-xs font-mono text-emerald-400 font-semibold tabular-nums">
                $\Delta$ {metrics.highestParityGame.spread.toFixed(2)} xG
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>{metrics.highestParityGame.game.rink}</span>
              {onSelectMatchupForPreview && (
                <button
                  onClick={() =>
                    onSelectMatchupForPreview(
                      metrics.highestParityGame!.homeTeam.id,
                      metrics.highestParityGame!.awayTeam.id
                    )
                  }
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  Analyze &rarr;
                </button>
              )}
            </div>
          </div>
        )}

        {metrics.worstBlowoutGame && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                HIGHEST BLOWOUT RISK FIXTURE
              </span>
              <span className="font-mono">{metrics.worstBlowoutGame.game.date}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">
                {metrics.worstBlowoutGame.homeTeam.name} vs{' '}
                {metrics.worstBlowoutGame.awayTeam.name}
              </span>
              <span className="text-xs font-mono text-rose-400 font-semibold tabular-nums">
                $\Delta$ {metrics.worstBlowoutGame.spread.toFixed(2)} xG
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>{metrics.worstBlowoutGame.game.rink}</span>
              {onSelectMatchupForPreview && (
                <button
                  onClick={() =>
                    onSelectMatchupForPreview(
                      metrics.worstBlowoutGame!.homeTeam.id,
                      metrics.worstBlowoutGame!.awayTeam.id
                    )
                  }
                  className="text-rose-400 hover:text-rose-300 font-medium"
                >
                  Inspect Blowout Odds &rarr;
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Team Strength of Schedule (SoS) Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Team Strength of Schedule (SoS) Parity Ledger
            </h3>
            <p className="text-xs text-slate-400">
              Evaluates schedule fairness, opponent rating difficulty, and projected win balances.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Sort by:</span>
            <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
              <button
                onClick={() => {
                  if (sortField === 'sos') setSortAsc(!sortAsc);
                  else {
                    setSortField('sos');
                    setSortAsc(false);
                  }
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  sortField === 'sos'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Opponent SoS
              </button>
              <button
                onClick={() => {
                  if (sortField === 'rating') setSortAsc(!sortAsc);
                  else {
                    setSortField('rating');
                    setSortAsc(false);
                  }
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  sortField === 'rating'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Team Rating
              </button>
              <button
                onClick={() => {
                  if (sortField === 'blowouts') setSortAsc(!sortAsc);
                  else {
                    setSortField('blowouts');
                    setSortAsc(false);
                  }
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  sortField === 'blowouts'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Blowout Risk
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-3 text-right">Rating</th>
                <th className="py-3 px-3 text-center">Games (H/A)</th>
                <th className="py-3 px-4 text-right">Opponent SoS</th>
                <th className="py-3 px-3 text-right">Projected (xW-xL)</th>
                <th className="py-3 px-3 text-center">Blowout Hazards</th>
                <th className="py-3 px-3 text-center">Rest Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {sortedTeamMetrics.map((tm, idx) => {
                const isToughest = tm.sosDifficultyRank === 1;
                const isSoftest = tm.sosDifficultyRank === metrics.teamsMetrics.length;

                return (
                  <tr
                    key={tm.teamId}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 text-center font-mono font-medium text-slate-500 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span>{tm.teamName}</span>
                        {isToughest && (
                          <span className="text-[10px] text-amber-400 font-mono">
                            [Toughest]
                          </span>
                        )}
                        {isSoftest && (
                          <span className="text-[10px] text-blue-400 font-mono">
                            [Softest]
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-slate-200">
                      {tm.rating.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400 tabular-nums">
                      {tm.gamesTotal} ({tm.homeGames}H / {tm.awayGames}A)
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-white">
                      {tm.avgOpponentRating.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                      {tm.expectedWins.toFixed(1)} - {tm.expectedLosses.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`font-mono font-semibold tabular-nums px-2 py-0.5 rounded text-xs ${
                          tm.blowoutHazardGames > 0
                            ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                            : 'text-slate-500'
                        }`}
                      >
                        {tm.blowoutHazardGames}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          tm.restViolations > 0 ? 'text-amber-400' : 'text-slate-500'
                        }`}
                      >
                        {tm.restViolations > 0 ? `${tm.restViolations} tight` : 'Nominal'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI League Commissioner Advisory Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              Tournament Commissioner Scheduling Audit
            </h3>
            <p className="text-xs text-slate-400">
              AI-driven synthesis of bracket fairness, rest intervals, and tier crossover recommendations.
            </p>
          </div>

          <button
            onClick={handleRequestAiAdvisory}
            disabled={isAiLoading}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/60 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm shadow-blue-500/20"
          >
            {isAiLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Auditing Schedule...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiAdvisory ? 'Re-audit Schedule' : 'Request Commissioner Advisory'}</span>
              </>
            )}
          </button>
        </div>

        {aiAdvisory ? (
          <div className="mt-4 space-y-4 pt-3 border-t border-slate-800">
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1">
                Executive Assessment
              </span>
              <p className="text-sm text-slate-200 leading-relaxed">
                {aiAdvisory.summary}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">
                Key Scheduling Recommendations:
              </span>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {aiAdvisory.recommendations.map((rec, idx) => (
                  <li
                    key={idx}
                    className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg flex items-start gap-2 text-slate-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {aiAdvisory.swapSuggestions && (
              <div className="p-3 bg-blue-950/30 border border-blue-900/50 rounded-lg text-xs text-blue-200">
                <strong className="text-blue-300 block font-semibold mb-0.5">
                  Rebalancing Suggestion:
                </strong>
                {aiAdvisory.swapSuggestions}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
            Click "Request Commissioner Advisory" for strategic feedback on tournament bracket fairness, flight structures, and mercy-rule risk mitigation.
          </div>
        )}
      </div>
    </div>
  );
};
