import { Sparkles, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { players, playerTeamHistory, playerSeasonStats, teams } from "@/lib/db/schema";
import { eq, desc, isNull } from "drizzle-orm";

interface PlayerProfileSummaryProps {
  playerId: string;
}

async function getPlayerContext(playerId: string) {
  // Get player details
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId));

  if (!player) return null;

  // Get career history
  const career = await db
    .select({
      team: teams,
      history: playerTeamHistory,
    })
    .from(playerTeamHistory)
    .innerJoin(teams, eq(teams.id, playerTeamHistory.teamId))
    .where(eq(playerTeamHistory.playerId, playerId))
    .orderBy(desc(playerTeamHistory.validFrom));

  // Get current team
  const currentTeam = career.find(c => c.history.validTo === null);

  // Get stats
  const stats = await db
    .select()
    .from(playerSeasonStats)
    .where(eq(playerSeasonStats.playerId, playerId));

  const totalGoals = stats.reduce((sum, s) => sum + s.goals, 0);
  const totalAssists = stats.reduce((sum, s) => sum + s.assists, 0);
  const totalApps = stats.reduce((sum, s) => sum + s.appearances, 0);

  return {
    player,
    career,
    currentTeam: currentTeam?.team,
    stats: { goals: totalGoals, assists: totalAssists, appearances: totalApps },
    clubCount: new Set(career.map(c => c.team.id)).size,
  };
}

function generateSummary(context: NonNullable<Awaited<ReturnType<typeof getPlayerContext>>>) {
  const { player, currentTeam, stats, clubCount } = context;

  const sentences: string[] = [];

  // Position and nationality
  if (player.nationality) {
    sentences.push(`${player.name} is a ${player.nationality} ${player.position?.toLowerCase() || "player"}.`);
  } else {
    sentences.push(`${player.name} is a professional ${player.position?.toLowerCase() || "football player"}.`);
  }

  // Current team
  if (currentTeam) {
    sentences.push(`Currently playing for ${currentTeam.name}.`);
  }

  // Career stats
  if (stats.appearances > 0) {
    const statParts = [];
    statParts.push(`${stats.appearances} appearances`);
    if (stats.goals > 0) statParts.push(`${stats.goals} goals`);
    if (stats.assists > 0) statParts.push(`${stats.assists} assists`);
    sentences.push(`Career statistics include ${statParts.join(", ")}.`);
  }

  // Club experience
  if (clubCount > 1) {
    sentences.push(`Has represented ${clubCount} clubs throughout their career.`);
  }

  return sentences.join(" ");
}

function getHighlights(context: NonNullable<Awaited<ReturnType<typeof getPlayerContext>>>) {
  const { player, stats, clubCount } = context;
  const highlights: string[] = [];

  if (player.position === "Forward" && stats.goals > 20) {
    highlights.push("Prolific scorer");
  } else if (player.position === "Midfielder" && stats.assists > 15) {
    highlights.push("Creative playmaker");
  } else if (player.position === "Defender" && stats.appearances > 100) {
    highlights.push("Defensive stalwart");
  } else if (player.position === "Goalkeeper" && stats.appearances > 50) {
    highlights.push("Experienced keeper");
  }

  if (clubCount >= 5) {
    highlights.push("Well-traveled");
  } else if (clubCount === 1) {
    highlights.push("Club loyal");
  }

  if (stats.appearances > 200) {
    highlights.push("Veteran");
  }

  if (stats.goals > 50) {
    highlights.push(`${stats.goals} career goals`);
  }

  return highlights.slice(0, 3);
}

export async function PlayerProfileSummary({ playerId }: PlayerProfileSummaryProps) {
  const context = await getPlayerContext(playerId);

  if (!context) return null;

  const summary = generateSummary(context);
  const highlights = getHighlights(context);

  if (!summary) return null;

  return (
    <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-bold text-neutral-900">Player Profile</h2>
        <span className="ml-auto text-xs text-neutral-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-purple-400" />
          Summary
        </span>
      </div>

      <div className="p-6">
        <p className="text-neutral-700 leading-relaxed">{summary}</p>

        {highlights.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {highlights.map((highlight, idx) => (
              <span
                key={idx}
                className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium"
              >
                {highlight}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
