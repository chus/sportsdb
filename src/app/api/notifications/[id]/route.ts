import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

const updateSchema = z.object({
  isRead: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { isRead } = updateSchema.parse(body);

    const [updated] = await db
      .update(notifications)
      .set({ isRead: isRead ?? true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Update notification error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const [deleted] = await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete notification error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
