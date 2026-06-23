import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outreachTargets } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

// /api/admin is NOT covered by the middleware matcher (it excludes /api), so
// these handlers must gate themselves.
async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === "admin" ? user : null;
}

const STATUS_ORDER = sql`CASE ${outreachTargets.status}
  WHEN 'replied' THEN 0 WHEN 'contacted' THEN 1 WHEN 'new' THEN 2 WHEN 'won' THEN 3 ELSE 4 END`;

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await db.select().from(outreachTargets).orderBy(STATUS_ORDER, desc(outreachTargets.updatedAt));
  return NextResponse.json({ targets: rows });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await request.json();
  if (!b.name || typeof b.name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const [row] = await db
    .insert(outreachTargets)
    .values({
      name: b.name.trim(),
      outlet: b.outlet || null,
      email: b.email || null,
      handle: b.handle || null,
      beat: b.beat || null,
      category: b.category || "journalist",
      url: b.url || null,
      notes: b.notes || null,
    })
    .returning();
  return NextResponse.json({ target: row });
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await request.json();
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const fields: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["name", "outlet", "email", "handle", "beat", "category", "url", "status", "notes", "lastStudyPitched"]) {
    if (k in b) fields[k] = b[k];
  }
  const [row] = await db.update(outreachTargets).set(fields).where(eq(outreachTargets.id, b.id)).returning();
  return NextResponse.json({ target: row });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(outreachTargets).where(eq(outreachTargets.id, id));
  return NextResponse.json({ success: true });
}
