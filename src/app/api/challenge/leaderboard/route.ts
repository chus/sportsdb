import { NextRequest, NextResponse } from "next/server";
import { getChallengeLeaderboard } from "@/lib/queries/challenge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

    const leaderboard = await getChallengeLeaderboard(limit);
    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("Challenge leaderboard error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
