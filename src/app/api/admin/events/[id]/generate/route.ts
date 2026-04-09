import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  generatePreviewForEvent,
  generateRecapForEvent,
  getEventContentSql,
  getOpenAiClient,
  loadSportsEventById,
} from "@/lib/content/event-generation";

export const maxDuration = 120;

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };
  if (user.role !== "admin") return { error: "Forbidden", status: 403 as const };
  return { user };
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type !== "preview" && type !== "recap") {
    return NextResponse.json(
      { error: "Query param `type` must be 'preview' or 'recap'" },
      { status: 400 }
    );
  }

  try {
    const sql = getEventContentSql();
    const event = await loadSportsEventById(sql, id);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const openai = getOpenAiClient();

    const result =
      type === "preview"
        ? await generatePreviewForEvent(sql, openai, event)
        : await generateRecapForEvent(sql, openai, event);

    if (!result.success) {
      return NextResponse.json(
        { error: result.reason },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      articleId: result.articleId,
      slug: result.slug,
      type: result.type,
    });
  } catch (err) {
    console.error("admin events generate error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Generation failed" },
      { status: 500 }
    );
  }
}
