import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserPredictionStats } from "@/lib/queries/predictions";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const stats = await getUserPredictionStats(user.id);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Get prediction stats error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
