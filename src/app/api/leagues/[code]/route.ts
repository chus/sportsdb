import { NextRequest, NextResponse } from "next/server";
import { getLeagueByCode, getLeagueLeaderboard, getLeagueMembers } from "@/lib/queries/leagues";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const league = await getLeagueByCode(code);

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const [leaderboard, members] = await Promise.all([
      getLeagueLeaderboard(league.id),
      getLeagueMembers(league.id),
    ]);

    return NextResponse.json({
      league: {
        id: league.id,
        name: league.name,
        code: league.code,
        memberCount: members.length,
        createdAt: league.createdAt,
      },
      leaderboard,
      members,
    });
  } catch (error) {
    console.error("Get league error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
