"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Trophy,
  Clock,
  Target,
  ArrowRightLeft,
  Calendar,
  Mail,
  Award,
  Loader2,
} from "lucide-react";

interface NotificationSettings {
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

const NOTIFICATION_TYPES = [
  {
    key: "goals" as const,
    label: "Goals",
    description: "Get notified when players you follow score",
    icon: Target,
  },
  {
    key: "matchStart" as const,
    label: "Match Start",
    description: "Notifications when matches are about to begin",
    icon: Clock,
  },
  {
    key: "matchResult" as const,
    label: "Match Results",
    description: "Final scores for teams and competitions you follow",
    icon: Trophy,
  },
  {
    key: "milestone" as const,
    label: "Milestones",
    description: "Player achievements like 100 goals, 500 appearances",
    icon: Award,
  },
  {
    key: "transfer" as const,
    label: "Transfers",
    description: "Transfer news for players and teams you follow",
    icon: ArrowRightLeft,
  },
  {
    key: "upcomingMatch" as const,
    label: "Upcoming Matches",
    description: "Reminders for matches happening soon",
    icon: Calendar,
  },
  {
    key: "weeklyDigest" as const,
    label: "Weekly Digest",
    description: "Summary of activity for entities you follow",
    icon: Mail,
  },
  {
    key: "achievement" as const,
    label: "Achievements",
    description: "Your SportsDB achievements and badges",
    icon: Award,
  },
];

export function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/notifications/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to fetch notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    if (!settings) return;

    setSaving(key);
    const previousValue = settings[key];
    setSettings({ ...settings, [key]: value });

    try {
      const res = await fetch("/api/notifications/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });

      if (!res.ok) {
        setSettings({ ...settings, [key]: previousValue });
      }
    } catch (error) {
      console.error("Failed to update setting:", error);
      setSettings({ ...settings, [key]: previousValue });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-neutral-500">
        Failed to load notification settings
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Global Settings */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50">
          <h3 className="font-semibold text-neutral-900">Global Settings</h3>
        </div>
        <div className="divide-y divide-neutral-100">
          <ToggleRow
            icon={Bell}
            label="Push Notifications"
            description="Receive push notifications on this device"
            checked={settings.pushEnabled}
            onChange={(v) => updateSetting("pushEnabled", v)}
            saving={saving === "pushEnabled"}
          />
          <ToggleRow
            icon={Mail}
            label="Email Notifications"
            description="Receive notifications via email"
            checked={settings.emailEnabled}
            onChange={(v) => updateSetting("emailEnabled", v)}
            saving={saving === "emailEnabled"}
          />
        </div>
      </div>

      {/* Notification Types */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50">
          <h3 className="font-semibold text-neutral-900">Notification Types</h3>
          <p className="text-sm text-neutral-500 mt-1">
            Choose which notifications you want to receive
          </p>
        </div>
        <div className="divide-y divide-neutral-100">
          {NOTIFICATION_TYPES.map((type) => (
            <ToggleRow
              key={type.key}
              icon={type.icon}
              label={type.label}
              description={type.description}
              checked={settings[type.key]}
              onChange={(v) => updateSetting(type.key, v)}
              saving={saving === type.key}
              disabled={!settings.pushEnabled && !settings.emailEnabled}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  saving,
  disabled,
}: {
  icon: typeof Bell;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  saving?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-6 py-4 ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-neutral-600" />
        </div>
        <div>
          <div className="font-medium text-neutral-900">{label}</div>
          <div className="text-sm text-neutral-500">{description}</div>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        disabled={saving || disabled}
        className={`relative w-12 h-7 rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-neutral-200"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {saving ? (
          <Loader2 className="absolute top-1 left-1 w-5 h-5 animate-spin text-white" />
        ) : (
          <span
            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        )}
      </button>
    </div>
  );
}
