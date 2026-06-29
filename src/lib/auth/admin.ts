import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * Admin gate for /api/admin/* route handlers.
 *
 * IMPORTANT: the Next.js middleware matcher excludes `/api`
 * (`["/((?!api|_next|.*\\..*).*)"]`), so admin API routes are NOT protected by
 * the middleware's admin check — every handler must gate itself. Call this at
 * the very top of each handler:
 *
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 *
 * Returns a 401/403 NextResponse when the caller is not an authenticated admin,
 * or null when access is granted.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}
