import { db } from "@/lib/db";
import { notificationSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface NotificationSettingsData {
  id: string;
  userId: string;
  goals: boolean;
  matchStart: boolean;
  matchResult: boolean;
  milestone: boolean;
  transfer: boolean;
  upcomingMatch: boolean;
  weeklyDigest: boolean;
  achievement: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
}

const DEFAULT_SETTINGS: Omit<NotificationSettingsData, "id" | "userId"> = {
  goals: true,
  matchStart: true,
  matchResult: true,
  milestone: true,
  transfer: true,
  upcomingMatch: true,
  weeklyDigest: true,
  achievement: true,
  pushEnabled: true,
  emailEnabled: false,
};

// Get user's notification settings (creates defaults if none exist)
export async function getNotificationSettings(
  userId: string
): Promise<NotificationSettingsData> {
  const [existing] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, userId))
    .limit(1);

  if (existing) {
    return {
      id: existing.id,
      userId: existing.userId,
      goals: existing.goals,
      matchStart: existing.matchStart,
      matchResult: existing.matchResult,
      milestone: existing.milestone,
      transfer: existing.transfer,
      upcomingMatch: existing.upcomingMatch,
      weeklyDigest: existing.weeklyDigest,
      achievement: existing.achievement,
      pushEnabled: existing.pushEnabled,
      emailEnabled: existing.emailEnabled,
    };
  }

  // Create default settings for new users
  const [newSettings] = await db
    .insert(notificationSettings)
    .values({
      userId,
      ...DEFAULT_SETTINGS,
    })
    .returning();

  return {
    id: newSettings.id,
    userId: newSettings.userId,
    goals: newSettings.goals,
    matchStart: newSettings.matchStart,
    matchResult: newSettings.matchResult,
    milestone: newSettings.milestone,
    transfer: newSettings.transfer,
    upcomingMatch: newSettings.upcomingMatch,
    weeklyDigest: newSettings.weeklyDigest,
    achievement: newSettings.achievement,
    pushEnabled: newSettings.pushEnabled,
    emailEnabled: newSettings.emailEnabled,
  };
}

// Update notification settings
export async function updateNotificationSettings(
  userId: string,
  updates: Partial<Omit<NotificationSettingsData, "id" | "userId">>
): Promise<NotificationSettingsData> {
  // Ensure settings exist first
  await getNotificationSettings(userId);

  const [updated] = await db
    .update(notificationSettings)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(notificationSettings.userId, userId))
    .returning();

  return {
    id: updated.id,
    userId: updated.userId,
    goals: updated.goals,
    matchStart: updated.matchStart,
    matchResult: updated.matchResult,
    milestone: updated.milestone,
    transfer: updated.transfer,
    upcomingMatch: updated.upcomingMatch,
    weeklyDigest: updated.weeklyDigest,
    achievement: updated.achievement,
    pushEnabled: updated.pushEnabled,
    emailEnabled: updated.emailEnabled,
  };
}

// Toggle a specific notification type
export async function toggleNotificationType(
  userId: string,
  type: keyof Omit<NotificationSettingsData, "id" | "userId">,
  enabled: boolean
): Promise<NotificationSettingsData> {
  return updateNotificationSettings(userId, { [type]: enabled });
}

// Enable/disable all notifications
export async function setAllNotifications(
  userId: string,
  enabled: boolean
): Promise<NotificationSettingsData> {
  return updateNotificationSettings(userId, {
    goals: enabled,
    matchStart: enabled,
    matchResult: enabled,
    milestone: enabled,
    transfer: enabled,
    upcomingMatch: enabled,
    weeklyDigest: enabled,
    achievement: enabled,
    pushEnabled: enabled,
  });
}
