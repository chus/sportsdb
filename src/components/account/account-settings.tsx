"use client";

import { useState } from "react";
import { User, Shield, Trash2 } from "lucide-react";
import { ProfileSection } from "./profile-section";
import { SecuritySection } from "./security-section";
import { DangerZoneSection } from "./danger-zone-section";

interface AccountSettingsProps {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    createdAt: string;
  };
}

type Tab = "profile" | "security" | "danger";

export function AccountSettings({ user }: AccountSettingsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  const tabs = [
    { id: "profile" as Tab, label: "Profile", icon: User },
    { id: "security" as Tab, label: "Security", icon: Shield },
    { id: "danger" as Tab, label: "Danger Zone", icon: Trash2 },
  ];

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <nav className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? "text-blue-600 border-blue-600"
                    : "text-neutral-600 border-transparent hover:text-neutral-900 hover:border-neutral-300"
                } ${tab.id === "danger" ? "text-red-600 hover:text-red-700" : ""}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "profile" && <ProfileSection user={user} />}
        {activeTab === "security" && <SecuritySection user={user} />}
        {activeTab === "danger" && <DangerZoneSection user={user} />}
      </div>
    </div>
  );
}
