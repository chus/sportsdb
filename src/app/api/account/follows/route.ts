import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getFollowedPlayers,
  getFollowedTeams,
  getFollowedCompetitions,
} from "@/lib/queries/follows";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    switch (type) {
      case "players":
        return NextResponse.json(await getFollowedPlayers(user.id));
      case "teams":
        return NextResponse.json(await getFollowedTeams(user.id));
      case "competitions":
        return NextResponse.json(await getFollowedCompetitions(user.id));
      default:
        return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
    }
  } catch (error) {
    console.error("Get follows error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
