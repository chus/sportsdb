import { NextRequest, NextResponse } from "next/server";
import { searchEntities } from "@/lib/queries/search";
import type { SearchResponse } from "@/types/api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";
  const type = searchParams.get("type") || undefined;
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  if (!query.trim()) {
    return NextResponse.json<SearchResponse>({
      results: [],
      total: 0,
      query: "",
    });
  }

  try {
    const results = await searchEntities(query, type, limit);

    return NextResponse.json<SearchResponse>({
      results,
      total: results.length,
      query,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
