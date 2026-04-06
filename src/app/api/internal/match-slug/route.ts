import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Internal slug-lookup endpoint used by middleware to 301 legacy
 * /matches/{uuid} URLs to /matches/{slug}.
 *
 * No auth — same data as the public match page itself.
 * Cached aggressively because slugs are stable for the lifetime of a match.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ slug: null }, { status: 400 });
  }

  const result = await db
    .select({ slug: matches.slug })
    .from(matches)
    .where(eq(matches.id, id))
    .limit(1);

  const slug = result[0]?.slug ?? null;

  return NextResponse.json(
    { slug },
    {
      headers: {
        // Slugs don't change once set; cache hard at the edge.
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
