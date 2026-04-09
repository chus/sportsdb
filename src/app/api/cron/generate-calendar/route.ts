import { NextRequest, NextResponse } from "next/server";
import { runCalendarGenerator } from "../../../../../scripts/generate-sports-calendar";

export const maxDuration = 300;

/**
 * Sports calendar cron.
 *
 * Scans the matches window around today and upserts into sports_events.
 * Scheduled daily at 03:00 UTC via vercel.json.
 */
export async function GET(request: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const windowDaysBack = Number(url.searchParams.get("back") ?? "7");
  const windowDaysForward = Number(url.searchParams.get("forward") ?? "90");

  try {
    const stats = await runCalendarGenerator({
      windowDaysBack,
      windowDaysForward,
      dryRun,
    });
    return NextResponse.json({
      success: true,
      dryRun,
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("generate-calendar cron failed:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
