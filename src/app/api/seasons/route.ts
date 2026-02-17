import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seasons } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const allSeasons = await db
      .select({
        id: seasons.id,
        label: seasons.label,
        isCurrent: seasons.isCurrent,
        startDate: seasons.startDate,
        endDate: seasons.endDate,
      })
      .from(seasons)
      .orderBy(desc(seasons.startDate));

    return NextResponse.json({ seasons: allSeasons });
  } catch (error) {
    console.error("Failed to fetch seasons:", error);
    return NextResponse.json(
      { error: "Failed to fetch seasons" },
      { status: 500 }
    );
  }
}
