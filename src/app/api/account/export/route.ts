import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  users,
  follows,
  userLeaguePreferences,
  bookmarks,
  bookmarkCollections,
  predictions,
  notificationSettings,
  subscriptions,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

function jsonToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown): string => {
    const str = val === null || val === undefined ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Query all user-related data in parallel
    const [
      profileRows,
      followRows,
      leaguePreferenceRows,
      bookmarkRows,
      bookmarkCollectionRows,
      predictionRows,
      notificationSettingsRows,
      subscriptionRows,
    ] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
          emailVerified: users.emailVerified,
        })
        .from(users)
        .where(eq(users.id, userId)),
      db
        .select({
          entityType: follows.entityType,
          entityId: follows.entityId,
          createdAt: follows.createdAt,
        })
        .from(follows)
        .where(eq(follows.userId, userId)),
      db
        .select({
          competitionId: userLeaguePreferences.competitionId,
          displayOrder: userLeaguePreferences.displayOrder,
          createdAt: userLeaguePreferences.createdAt,
        })
        .from(userLeaguePreferences)
        .where(eq(userLeaguePreferences.userId, userId)),
      db
        .select({
          entityType: bookmarks.entityType,
          entityId: bookmarks.entityId,
          collectionId: bookmarks.collectionId,
          notes: bookmarks.notes,
          createdAt: bookmarks.createdAt,
        })
        .from(bookmarks)
        .where(eq(bookmarks.userId, userId)),
      db
        .select({
          id: bookmarkCollections.id,
          name: bookmarkCollections.name,
          color: bookmarkCollections.color,
          createdAt: bookmarkCollections.createdAt,
        })
        .from(bookmarkCollections)
        .where(eq(bookmarkCollections.userId, userId)),
      db
        .select({
          matchId: predictions.matchId,
          homeScore: predictions.homeScore,
          awayScore: predictions.awayScore,
          points: predictions.points,
          isExactScore: predictions.isExactScore,
          isCorrectResult: predictions.isCorrectResult,
          submittedAt: predictions.submittedAt,
          scoredAt: predictions.scoredAt,
        })
        .from(predictions)
        .where(eq(predictions.userId, userId)),
      db
        .select({
          goals: notificationSettings.goals,
          matchStart: notificationSettings.matchStart,
          matchResult: notificationSettings.matchResult,
          milestone: notificationSettings.milestone,
          transfer: notificationSettings.transfer,
          upcomingMatch: notificationSettings.upcomingMatch,
          weeklyDigest: notificationSettings.weeklyDigest,
          achievement: notificationSettings.achievement,
          pushEnabled: notificationSettings.pushEnabled,
          emailEnabled: notificationSettings.emailEnabled,
        })
        .from(notificationSettings)
        .where(eq(notificationSettings.userId, userId)),
      db
        .select({
          tier: subscriptions.tier,
          status: subscriptions.status,
          startDate: subscriptions.startDate,
          endDate: subscriptions.endDate,
        })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId)),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      userId,
      profile: profileRows[0] ?? null,
      follows: followRows,
      leaguePreferences: leaguePreferenceRows,
      bookmarks: bookmarkRows,
      bookmarkCollections: bookmarkCollectionRows,
      predictions: predictionRows,
      notificationSettings: notificationSettingsRows[0] ?? null,
      subscription: subscriptionRows[0] ?? null,
    };

    const format = request.nextUrl.searchParams.get("format");

    if (format === "csv") {
      const sections: string[] = [];

      sections.push("# Profile");
      sections.push(jsonToCsv(profileRows.length > 0 ? profileRows as Record<string, unknown>[] : []));

      sections.push("\n# Follows");
      sections.push(jsonToCsv(followRows as Record<string, unknown>[]));

      sections.push("\n# League Preferences");
      sections.push(jsonToCsv(leaguePreferenceRows as Record<string, unknown>[]));

      sections.push("\n# Bookmarks");
      sections.push(jsonToCsv(bookmarkRows as Record<string, unknown>[]));

      sections.push("\n# Bookmark Collections");
      sections.push(jsonToCsv(bookmarkCollectionRows as Record<string, unknown>[]));

      sections.push("\n# Predictions");
      sections.push(jsonToCsv(predictionRows as Record<string, unknown>[]));

      sections.push("\n# Notification Settings");
      sections.push(jsonToCsv(notificationSettingsRows.length > 0 ? notificationSettingsRows as Record<string, unknown>[] : []));

      sections.push("\n# Subscription");
      sections.push(jsonToCsv(subscriptionRows.length > 0 ? subscriptionRows as Record<string, unknown>[] : []));

      return new NextResponse(sections.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition":
            'attachment; filename="sportsdb-data-export.csv"',
        },
      });
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition":
          'attachment; filename="sportsdb-data-export.json"',
      },
    });
  } catch (error) {
    console.error("Data export error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
