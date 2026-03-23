import { NextRequest, NextResponse } from "next/server";
import { getPickemLeaderboard } from "@/lib/queries/pickem";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

    const leaderboard = await getPickemLeaderboard(limit);
    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("Pickem leaderboard error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
