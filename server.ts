import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());

// Initialize Google GenAI client if API key is present
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', hasGeminiKey: Boolean(apiKey) });
});

// AI Scouting Report for Matchup
app.post('/api/ai/matchup-scouting', async (req: Request, res: Response) => {
  try {
    const { homeTeam, awayTeam, prediction, customFactors } = req.body;

    if (!homeTeam || !awayTeam) {
      res.status(400).json({ error: 'Missing homeTeam or awayTeam data' });
      return;
    }

    if (!ai) {
      // Graceful fallback if no Gemini API key configured
      res.json({
        tacticalBreakdown: `The matchup between ${homeTeam.name} and ${awayTeam.name} presents a rating delta of ${Math.abs(homeTeam.rating - awayTeam.rating).toFixed(1)} pts. ${
          homeTeam.rating >= awayTeam.rating ? homeTeam.name : awayTeam.name
        } controls transition advantage. Discipline in the penalty box and goaltending puck-tracking through low traffic will dictate parity.`,
        keysToWinHome: [
          `Exploit home ice geometry (${homeTeam.rinkType || 'Standard NHL'}) with aggressive forechecking.`,
          `Limit defensive turnovers; capitalize on powerplay opportunities (${homeTeam.specialTeamsPowerPlay || 20}% PP).`,
          `Protect high-danger slot rebounds in front of ${homeTeam.goalieName || 'Netminder'}.`
        ],
        keysToWinAway: [
          `Survive the opening 10 minutes against home crowd momentum.`,
          `Test opposing goalie early with low screens and crash the crease.`,
          `Stay out of the box (keep PIMs under ${awayTeam.pimPerGame || 6} mins).`
        ],
        blowoutPreventionTip: prediction.blowoutRiskPct > 35
          ? 'High blowout risk alert: Tournament director should consider running clock enforcement if spread exceeds 5 goals by 2nd intermission.'
          : 'Competitive spread predicted: Expect tight back-and-forth action with high developmental value.',
        isAiGenerated: false
      });
      return;
    }

    const prompt = `You are a USA Hockey Master Level Coach and Tournament Director Analyst.
Analyze this upcoming youth hockey matchup and give an insightful, professional scouting report and parity assessment.

HOME TEAM:
- Name: ${homeTeam.name} (${homeTeam.ageGroup || '14U'} ${homeTeam.tier || 'AAA'})
- Rating: ${homeTeam.rating} | Offense: ${homeTeam.offenseRating}/100 | Defense: ${homeTeam.defenseRating}/100
- Goalie Save %: ${homeTeam.goalieSavePct} (${homeTeam.goalieName || 'Starting Goalie'})
- PIM/Game: ${homeTeam.pimPerGame} mins
- Home Rink: ${homeTeam.homeRink || 'Home Arena'} (${homeTeam.rinkType || 'Standard NHL 200x85'})

AWAY TEAM:
- Name: ${awayTeam.name} (${awayTeam.ageGroup || '14U'} ${awayTeam.tier || 'AAA'})
- Rating: ${awayTeam.rating} | Offense: ${awayTeam.offenseRating}/100 | Defense: ${awayTeam.defenseRating}/100
- Goalie Save %: ${awayTeam.goalieSavePct} (${awayTeam.goalieName || 'Starting Goalie'})
- PIM/Game: ${awayTeam.pimPerGame} mins

MATHEMATICAL SIMULATION STATS:
- Projected Score: ${homeTeam.name} ${prediction.expectedGoalsHome.toFixed(1)} - ${prediction.expectedGoalsAway.toFixed(1)} ${awayTeam.name}
- Win Probabilities: Home ${prediction.homeWinPct.toFixed(1)}%, Away ${prediction.awayWinPct.toFixed(1)}%, Overtime/Tie ${prediction.tieOrOtPct.toFixed(1)}%
- Blowout Hazard Risk (5+ goal differential): ${prediction.blowoutRiskPct.toFixed(1)}%
- Parity Classification: ${prediction.parityTier}
${customFactors ? `Context modifiers: ${JSON.stringify(customFactors)}` : ''}

Respond in concise JSON with these fields:
{
  "tacticalBreakdown": "2-3 sentences of sharp tactical analysis focusing on systems, pace, and puck management",
  "keysToWinHome": ["Key 1", "Key 2", "Key 3"],
  "keysToWinAway": ["Key 1", "Key 2", "Key 3"],
  "blowoutPreventionTip": "One strategic tip for coaches or tournament officials to maintain competitive integrity"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      ...parsed,
      isAiGenerated: true,
    });
  } catch (error: any) {
    console.error('Error generating matchup scouting:', error);
    res.status(500).json({
      error: 'Failed to generate scouting report',
      details: error?.message || String(error)
    });
  }
});

// AI Schedule Parity Advisor
app.post('/api/ai/schedule-parity-advisor', async (req: Request, res: Response) => {
  try {
    const { scheduleSummary, teamMetrics } = req.body;

    if (!scheduleSummary) {
      res.status(400).json({ error: 'Missing scheduleSummary data' });
      return;
    }

    if (!ai) {
      res.json({
        summary: `Schedule parity score is ${scheduleSummary.parityScore}/100 with ${scheduleSummary.blowoutRiskGamesCount} high-blowout hazard games identified.`,
        recommendations: [
          'Review crossover games involving bottom-tier seeds against top 2 seeds.',
          'Balance home-and-away distribution to avoid road fatigue streaks.',
          'Stagger back-to-back weekend fixtures to ensure minimum 4 hours rest between ice times.'
        ],
        isAiGenerated: false
      });
      return;
    }

    const prompt = `You are a veteran Youth Hockey League Commissioner & Scheduler.
Evaluate the following schedule parity analytics for a youth hockey division:

SCHEDULE METRICS:
- Overall Parity Index Score: ${scheduleSummary.parityScore}/100
- Total Games: ${scheduleSummary.totalGames}
- Blowout Hazard Games (Expected goal diff >= 4.0): ${scheduleSummary.blowoutRiskGamesCount} (${scheduleSummary.blowoutRiskPct.toFixed(1)}%)
- Highly Competitive Games (Expected goal diff <= 1.5): ${scheduleSummary.competitiveGamesCount} (${scheduleSummary.competitivePct.toFixed(1)}%)
- Max Strength of Schedule (SoS) Disparity: ${scheduleSummary.maxSosDisparity.toFixed(2)} rating pts

TEAM SOS BREAKDOWN:
${JSON.stringify(teamMetrics, null, 2)}

Provide an executive scheduling advisory in JSON format:
{
  "summary": "2 sentences summarizing the competitive balance health of this schedule",
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3"
  ],
  "swapSuggestions": "One suggested fixture rebalancing strategy to optimize competitive parity"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      ...parsed,
      isAiGenerated: true,
    });
  } catch (error: any) {
    console.error('Error in schedule parity advisor:', error);
    res.status(500).json({
      error: 'Failed to generate advisory',
      details: error?.message || String(error)
    });
  }
});

// Setup Vite or static serving
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`PuckParity server listening on http://0.0.0.0:${port} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
