import { NextRequest, NextResponse } from "next/server";
import { getGlobalLeaderboard } from "@/lib/queries/predictions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "50");

    const leaderboard = await getGlobalLeaderboard(limit);
    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
