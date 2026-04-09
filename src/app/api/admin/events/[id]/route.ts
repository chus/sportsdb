import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { competitions, sportsEvents, articles } from "@/lib/db/schema";
import { and } from "drizzle-orm";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };
  if (user.role !== "admin") return { error: "Forbidden", status: 403 as const };
  return { user };
}

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  importance: z.number().int().min(1).max(5).optional(),
  isFeatured: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;

  let parsed: z.infer<typeof updateSchema>;
  try {
    const body = await request.json();
    parsed = updateSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Invalid request body" },
      { status: 400 }
    );
  }

  const patch: Partial<typeof sportsEvents.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.title !== undefined) patch.title = parsed.title;
  if (parsed.description !== undefined) patch.description = parsed.description;
  if (parsed.importance !== undefined) patch.importance = parsed.importance;
  if (parsed.isFeatured !== undefined) patch.isFeatured = parsed.isFeatured;

  const updated = await db
    .update(sportsEvents)
    .set(patch)
    .where(eq(sportsEvents.id, id))
    .returning({
      id: sportsEvents.id,
      date: sportsEvents.date,
      type: sportsEvents.type,
      title: sportsEvents.title,
      description: sportsEvents.description,
      importance: sportsEvents.importance,
      isFeatured: sportsEvents.isFeatured,
      matchIds: sportsEvents.matchIds,
      competitionId: sportsEvents.competitionId,
    });

  if (!updated.length) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const row = updated[0];

  const [compRow] = row.competitionId
    ? await db
        .select({ name: competitions.name })
        .from(competitions)
        .where(eq(competitions.id, row.competitionId))
        .limit(1)
    : [];

  const [previewRow] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(
        eq(articles.sportsEventId, row.id),
        eq(articles.type, "event_preview")
      )
    )
    .limit(1);

  const [recapRow] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(
        eq(articles.sportsEventId, row.id),
        eq(articles.type, "event_recap")
      )
    )
    .limit(1);

  return NextResponse.json({
    event: {
      id: row.id,
      date: String(row.date),
      type: row.type,
      title: row.title,
      description: row.description,
      importance: row.importance,
      isFeatured: row.isFeatured,
      matchIds: (row.matchIds as string[]) ?? [],
      competitionId: row.competitionId,
      competitionName: compRow?.name ?? null,
      hasPreview: !!previewRow,
      hasRecap: !!recapRow,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;

  const deleted = await db
    .delete(sportsEvents)
    .where(eq(sportsEvents.id, id))
    .returning({ id: sportsEvents.id });

  if (!deleted.length) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
