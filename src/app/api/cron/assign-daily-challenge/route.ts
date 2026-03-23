import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { challengeQuestions } from "@/lib/db/schema";
import { sql, isNull, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const QUESTIONS_PER_DAY = 5;

    // Check if today already has questions assigned
    const [existing] = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(challengeQuestions)
      .where(eq(challengeQuestions.activeDate, today));

    const existingCount = Number(existing?.cnt ?? 0);

    if (existingCount >= QUESTIONS_PER_DAY) {
      return NextResponse.json({
        message: "Today already has enough questions",
        date: today,
        count: existingCount,
      });
    }

    const needed = QUESTIONS_PER_DAY - existingCount;

    // Grab unassigned pool questions with category variety
    const poolQuestions = await db
      .select({ id: challengeQuestions.id })
      .from(challengeQuestions)
      .where(isNull(challengeQuestions.activeDate))
      .orderBy(sql`random()`)
      .limit(needed);

    if (poolQuestions.length === 0) {
      return NextResponse.json(
        {
          error: "No pool questions available",
          date: today,
          existingCount,
        },
        { status: 500 }
      );
    }

    // Assign them to today
    const ids = poolQuestions.map((q) => q.id);
    await db
      .update(challengeQuestions)
      .set({ activeDate: today })
      .where(sql`${challengeQuestions.id} = ANY(${ids}::uuid[])`);

    return NextResponse.json({
      message: "Daily challenge questions assigned",
      date: today,
      assigned: ids.length,
      total: existingCount + ids.length,
    });
  } catch (error) {
    console.error("Assign daily challenge error:", error);
    return NextResponse.json(
      { error: "Failed to assign questions" },
      { status: 500 }
    );
  }
}
