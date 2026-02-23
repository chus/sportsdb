import { NextResponse } from "next/server";
import { getAvailableMatches } from "@/lib/queries/predictions";

export async function GET() {
  try {
    const matches = await getAvailableMatches();
    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Get available matches error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
