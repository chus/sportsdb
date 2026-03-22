import { NextRequest, NextResponse } from "next/server";
import { getPlayerStats } from "@/lib/queries/players";

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get("ids");
  if (!ids) {
    return NextResponse.json({ error: "ids parameter required" }, { status: 400 });
  }

  const playerIds = ids.split(",").slice(0, 4);

  const results: Record<string, { appearances: number; goals: number; assists: number; minutesPlayed: number }> = {};

  await Promise.all(
    playerIds.map(async (id) => {
      const stats = await getPlayerStats(id);
      const totals = stats.reduce(
        (acc, s) => ({
          appearances: acc.appearances + s.stat.appearances,
          goals: acc.goals + s.stat.goals,
          assists: acc.assists + s.stat.assists,
          minutesPlayed: acc.minutesPlayed + s.stat.minutesPlayed,
        }),
        { appearances: 0, goals: 0, assists: 0, minutesPlayed: 0 }
      );
      results[id] = totals;
    })
  );

  return NextResponse.json({ stats: results });
}
