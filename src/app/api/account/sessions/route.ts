import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq, gt, desc } from "drizzle-orm";
import { getCurrentUser, getSessionCookie, deleteSession } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentToken = await getSessionCookie();

    const userSessions = await db
      .select({
        id: sessions.id,
        token: sessions.token,
        userAgent: sessions.userAgent,
        ipAddress: sessions.ipAddress,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(
        eq(sessions.userId, user.id),
      )
      .orderBy(desc(sessions.createdAt));

    // Mark current session and parse user agent
    const sessionsWithInfo = userSessions.map((session) => {
      const isCurrent = session.token === currentToken;
      const device = parseUserAgent(session.userAgent);

      return {
        id: session.id,
        device,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        isCurrent,
        isExpired: session.expiresAt ? new Date(session.expiresAt) < new Date() : false,
      };
    });

    // Filter out expired sessions from the response
    const activeSessions = sessionsWithInfo.filter((s) => !s.isExpired);

    return NextResponse.json({ sessions: activeSessions });
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("id");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Find the session to get its token
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check if trying to revoke current session
    const currentToken = await getSessionCookie();
    if (session.token === currentToken) {
      return NextResponse.json(
        { error: "Cannot revoke current session. Use logout instead." },
        { status: 400 }
      );
    }

    await deleteSession(session.token);

    return NextResponse.json({ success: true, message: "Session revoked" });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

function parseUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  // Simple parsing - can be enhanced with a proper UA parser library
  if (userAgent.includes("Mobile")) {
    if (userAgent.includes("iPhone")) return "iPhone";
    if (userAgent.includes("Android")) return "Android Phone";
    return "Mobile Device";
  }

  if (userAgent.includes("Tablet") || userAgent.includes("iPad")) {
    return "Tablet";
  }

  // Desktop browsers
  if (userAgent.includes("Chrome")) {
    if (userAgent.includes("Edg")) return "Microsoft Edge";
    return "Chrome";
  }
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";

  // Operating systems
  if (userAgent.includes("Windows")) return "Windows PC";
  if (userAgent.includes("Mac")) return "Mac";
  if (userAgent.includes("Linux")) return "Linux PC";

  return "Desktop";
}
