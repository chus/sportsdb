import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { followEntity, unfollowEntity, isFollowing } from "@/lib/queries/follows";
import { canUserFollow } from "@/lib/queries/subscriptions";

const followSchema = z.object({
  entityType: z.enum(["player", "team", "competition"]),
  entityId: z.string().uuid(),
  action: z.enum(["follow", "unfollow"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to follow" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entityType, entityId, action } = followSchema.parse(body);

    if (action === "follow") {
      const { allowed, reason } = await canUserFollow(user.id);
      if (!allowed) {
        return NextResponse.json(
          { error: reason || "Follow limit reached" },
          { status: 403 }
        );
      }
      await followEntity(user.id, entityType, entityId);
    } else {
      await unfollowEntity(user.id, entityType, entityId);
    }

    const following = await isFollowing(user.id, entityType, entityId);

    return NextResponse.json({ following });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Follow error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ following: false });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") as "player" | "team" | "competition";
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "Missing entityType or entityId" },
        { status: 400 }
      );
    }

    const following = await isFollowing(user.id, entityType, entityId);

    return NextResponse.json({ following });
  } catch (error) {
    console.error("Get follow status error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
