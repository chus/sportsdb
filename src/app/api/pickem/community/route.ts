import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPickemCommunityPercentages } from "@/lib/queries/pickem";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchIdsParam = searchParams.get("matchIds");

    if (!matchIdsParam) {
      return NextResponse.json({ error: "matchIds required" }, { status: 400 });
    }

    const matchIds = matchIdsParam.split(",").filter(Boolean);
    if (matchIds.length === 0 || matchIds.length > 50) {
      return NextResponse.json(
        { error: "Provide 1-50 match IDs" },
        { status: 400 }
      );
    }

    const percentages = await getPickemCommunityPercentages(matchIds);
    return NextResponse.json({ percentages });
  } catch (error) {
    console.error("Community percentages error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
