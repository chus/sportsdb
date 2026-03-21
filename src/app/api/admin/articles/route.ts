import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { articles, competitions, competitionSeasons } from "@/lib/db/schema";
import { eq, count, desc } from "drizzle-orm";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }
  if (user.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }
  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    const [articleRows, totalResult] = await Promise.all([
      db
        .select({
          id: articles.id,
          title: articles.title,
          type: articles.type,
          status: articles.status,
          createdAt: articles.createdAt,
          competitionName: competitions.name,
        })
        .from(articles)
        .leftJoin(
          competitionSeasons,
          eq(articles.competitionSeasonId, competitionSeasons.id)
        )
        .leftJoin(
          competitions,
          eq(competitionSeasons.competitionId, competitions.id)
        )
        .orderBy(desc(articles.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(articles),
    ]);

    return NextResponse.json({
      articles: articleRows,
      total: totalResult[0]?.total ?? 0,
    });
  } catch (error) {
    console.error("Admin articles GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const body = await request.json();
    const { articleId, status } = body as {
      articleId: string;
      status: string;
    };

    if (!articleId || !status) {
      return NextResponse.json(
        { error: "articleId and status are required" },
        { status: 400 }
      );
    }

    if (!["published", "draft"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be 'published' or 'draft'" },
        { status: 400 }
      );
    }

    await db
      .update(articles)
      .set({
        status,
        publishedAt: status === "published" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin articles PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update article" },
      { status: 500 }
    );
  }
}
