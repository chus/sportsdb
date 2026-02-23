import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, follows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

const completeSchema = z.object({
  players: z.array(z.string().uuid()),
  teams: z.array(z.string().uuid()),
  competitions: z.array(z.string().uuid()),
});

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
    const { players, teams, competitions } = completeSchema.parse(body);

    // Bulk insert follows for all selected entities
    const followsToInsert = [
      ...players.map((id) => ({
        userId: user.id,
        entityType: "player" as const,
        entityId: id,
      })),
      ...teams.map((id) => ({
        userId: user.id,
        entityType: "team" as const,
        entityId: id,
      })),
      ...competitions.map((id) => ({
        userId: user.id,
        entityType: "competition" as const,
        entityId: id,
      })),
    ];

    if (followsToInsert.length > 0) {
      await db
        .insert(follows)
        .values(followsToInsert)
        .onConflictDoNothing();
    }

    // Mark onboarding as complete
    await db
      .update(users)
      .set({
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      followedCount: followsToInsert.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Failed to complete onboarding:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
