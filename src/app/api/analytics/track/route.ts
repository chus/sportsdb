import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";

const eventSchema = z.object({
  eventType: z.enum(["page_view", "search", "follow", "click", "share"]),
  entityType: z.enum(["player", "team", "competition", "match"]).optional(),
  entityId: z.string().uuid().optional(),
  searchQuery: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  referrer: z.string().optional(),
});

const batchSchema = z.object({
  events: z.array(eventSchema),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    const { events, sessionId } = batchSchema.parse(body);

    const eventsToInsert = events.map((event) => ({
      userId: user?.id ?? null,
      sessionId: sessionId ?? null,
      eventType: event.eventType,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      searchQuery: event.searchQuery ?? null,
      referrer: event.referrer ?? null,
    }));

    await db.insert(analyticsEvents).values(eventsToInsert);

    return NextResponse.json({ success: true, count: events.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Analytics track error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
