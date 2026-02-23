import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bookmarks, players, teams, competitions, matches } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

const createSchema = z.object({
  entityType: z.enum(["player", "team", "competition", "match"]),
  entityId: z.string().uuid(),
  collectionId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const userBookmarks = await db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, user.id))
      .orderBy(desc(bookmarks.createdAt));

    // Enrich with entity details
    const enriched = await Promise.all(
      userBookmarks.map(async (bookmark) => {
        let entityDetails = null;

        if (bookmark.entityType === "player") {
          const [player] = await db
            .select({
              name: players.name,
              slug: players.slug,
              imageUrl: players.imageUrl,
              position: players.position,
            })
            .from(players)
            .where(eq(players.id, bookmark.entityId))
            .limit(1);
          entityDetails = player;
        } else if (bookmark.entityType === "team") {
          const [team] = await db
            .select({
              name: teams.name,
              slug: teams.slug,
              logoUrl: teams.logoUrl,
              country: teams.country,
            })
            .from(teams)
            .where(eq(teams.id, bookmark.entityId))
            .limit(1);
          entityDetails = team;
        } else if (bookmark.entityType === "competition") {
          const [comp] = await db
            .select({
              name: competitions.name,
              slug: competitions.slug,
              logoUrl: competitions.logoUrl,
            })
            .from(competitions)
            .where(eq(competitions.id, bookmark.entityId))
            .limit(1);
          entityDetails = comp;
        }

        return {
          ...bookmark,
          entity: entityDetails,
        };
      })
    );

    return NextResponse.json({ bookmarks: enriched });
  } catch (error) {
    console.error("Get bookmarks error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entityType, entityId, collectionId, notes } = createSchema.parse(body);

    const [bookmark] = await db
      .insert(bookmarks)
      .values({
        userId: user.id,
        entityType,
        entityId,
        collectionId: collectionId ?? null,
        notes: notes ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (!bookmark) {
      // Already bookmarked, return existing
      const [existing] = await db
        .select()
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, user.id),
            eq(bookmarks.entityType, entityType),
            eq(bookmarks.entityId, entityId)
          )
        )
        .limit(1);
      return NextResponse.json(existing);
    }

    return NextResponse.json(bookmark);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Create bookmark error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "Missing entityType or entityId" },
        { status: 400 }
      );
    }

    await db
      .delete(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, user.id),
          eq(bookmarks.entityType, entityType),
          eq(bookmarks.entityId, entityId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete bookmark error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
