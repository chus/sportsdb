"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Heart,
  Users,
  Trophy,
  Settings,
  CreditCard,
  Lock,
  Bell,
  Mail,
  Smartphone,
  Loader2,
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { useAuth } from "@/components/auth/auth-provider";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { PricingCards } from "@/components/subscription/pricing-cards";
import { cn } from "@/lib/utils/cn";

type Tab = "profile" | "settings" | "billing";

interface FollowedPlayer {
  follow: { id: string; createdAt: string | null };
  player: { id: string; name: string; slug: string; position: string; nationality: string | null };
}
interface FollowedTeam {
  follow: { id: string; createdAt: string | null };
  team: { id: string; name: string; slug: string; country: string; logoUrl: string | null };
}
interface FollowedCompetition {
  follow: { id: string; createdAt: string | null };
  competition: { id: string; name: string; slug: string; type: string };
}
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

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const { tier, subscription } = useSubscription();
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Profile state
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [memberSince, setMemberSince] = useState("");

  // Follows state
  const [followedPlayers, setFollowedPlayers] = useState<FollowedPlayer[]>([]);
  const [followedTeams, setFollowedTeams] = useState<FollowedTeam[]>([]);
  const [followedCompetitions, setFollowedCompetitions] = useState<FollowedCompetition[]>([]);
  const [followsLoading, setFollowsLoading] = useState(true);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Notification settings
  const [notifSettings, setNotifSettings] = useState<NotificationSettings | null>(null);
  const [notifLoading, setNotifLoading] = useState(true);

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      fetchFollows();
      fetchNotificationSettings();
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/me");
      if (res.ok) {
        const data = await res.json();
        if (data.createdAt) {
          setMemberSince(
            new Date(data.createdAt).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })
          );
        }
      }
    } catch {
      // Silently fail
    }
  };

  const fetchFollows = async () => {
    try {
      const [playersRes, teamsRes, compsRes] = await Promise.all([
        fetch("/api/account/follows?type=players"),
        fetch("/api/account/follows?type=teams"),
        fetch("/api/account/follows?type=competitions"),
      ]);
      if (playersRes.ok) setFollowedPlayers(await playersRes.json());
      if (teamsRes.ok) setFollowedTeams(await teamsRes.json());
      if (compsRes.ok) setFollowedCompetitions(await compsRes.json());
    } catch {
      // Silently fail — data will just be empty
    } finally {
      setFollowsLoading(false);
    }
  };

  const fetchNotificationSettings = async () => {
    try {
      const res = await fetch("/api/notifications/settings");
      if (res.ok) {
        setNotifSettings(await res.json());
      }
    } catch {
      // Use defaults
    } finally {
      setNotifLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    setNameSuccess(false);
    try {
      const res = await fetch("/api/user/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        setNameSuccess(true);
        setEditingName(false);
        await refreshUser();
        setTimeout(() => setNameSuccess(false), 3000);
      }
    } catch {
      // Error handling
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        setPasswordError(data.error || "Failed to change password");
      }
    } catch {
      setPasswordError("Something went wrong");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggleNotification = async (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    if (!notifSettings) return;
    const prev = { ...notifSettings };
    setNotifSettings({ ...notifSettings, [key]: value });
    try {
      const res = await fetch("/api/notifications/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        setNotifSettings(prev);
      }
    } catch {
      setNotifSettings(prev);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    if (deleteConfirmation !== "DELETE") {
      setDeleteError("Please type DELETE to confirm");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword, confirmation: deleteConfirmation }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setDeleteError(data.error || "Failed to delete account");
      }
    } catch {
      setDeleteError("Something went wrong");
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const userInitial = user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase();
  const totalFollowing = followedPlayers.length + followedTeams.length + followedCompetitions.length;

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "billing", label: "Billing", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-4xl font-bold">
              {userInitial}
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">{user.name || "Sports Fan"}</h1>
              <p className="text-blue-100">Member since {memberSince}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <div className="text-3xl font-bold">{totalFollowing}</div>
              <div className="text-sm text-blue-100 mt-1">Following</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <div className="text-3xl font-bold">{followedPlayers.length}</div>
              <div className="text-sm text-blue-100 mt-1">Players</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <div className="text-3xl font-bold">{followedTeams.length}</div>
              <div className="text-sm text-blue-100 mt-1">Teams</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tab Navigation */}
      <div className="sticky top-[73px] z-40 bg-white border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-neutral-600 hover:text-neutral-900 hover:border-neutral-300"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* ==================== PROFILE TAB ==================== */}
        {activeTab === "profile" && (
          <div className="space-y-12">
            {/* Edit Name */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <h2 className="text-xl font-bold text-neutral-900 mb-6">Edit Profile</h2>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!editingName}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  />
                </div>
                {editingName ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setName(user.name || "");
                      }}
                      className="px-4 py-2.5 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveName}
                      disabled={savingName || !name.trim()}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingName(true)}
                    className="px-4 py-2.5 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
              {nameSuccess && (
                <div className="mt-3 flex items-center gap-2 text-green-600 text-sm">
                  <Check className="w-4 h-4" />
                  Name updated successfully
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <p className="text-sm text-neutral-500">
                  Email: {user.email}
                </p>
              </div>
            </div>

            {/* Followed Entities */}
            {followsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
              </div>
            ) : totalFollowing === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-neutral-200 text-center">
                <Heart className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-neutral-900 mb-2">Start following entities</h2>
                <p className="text-neutral-600 mb-6">
                  Follow players, teams, and competitions to build your personalized experience
                </p>
                <Link
                  href="/search"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  Explore SportsDB
                </Link>
              </div>
            ) : (
              <div className="space-y-10">
                {followedPlayers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <Heart className="w-6 h-6 text-blue-600 fill-current" />
                      <h2 className="text-2xl font-bold">Followed Players ({followedPlayers.length})</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {followedPlayers.map(({ follow, player }) => (
                        <Link
                          key={follow.id}
                          href={`/players/${player.slug}`}
                          className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-lg hover:border-blue-300 transition-all group"
                        >
                          <div className="flex items-center gap-4 mb-3">
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">
                              {player.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                                {player.name}
                              </h3>
                              <p className="text-sm text-neutral-500 truncate">
                                {player.position}{player.nationality ? ` · ${player.nationality}` : ""}
                              </p>
                            </div>
                          </div>
                          {follow.createdAt && (
                            <div className="text-xs text-neutral-400">
                              Following since {new Date(follow.createdAt).toLocaleDateString()}
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {followedTeams.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <Users className="w-6 h-6 text-green-600" />
                      <h2 className="text-2xl font-bold">Followed Teams ({followedTeams.length})</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {followedTeams.map(({ follow, team }) => (
                        <Link
                          key={follow.id}
                          href={`/teams/${team.slug}`}
                          className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-lg hover:border-green-300 transition-all group"
                        >
                          <div className="flex items-center gap-4 mb-3">
                            <div className="w-14 h-14 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center overflow-hidden">
                              {team.logoUrl ? (
                                <ImageWithFallback src={team.logoUrl} alt={team.name} className="w-full h-full object-contain p-2" width={56} height={56} />
                              ) : (
                                <span className="text-white font-bold">
                                  {team.name.substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-neutral-900 group-hover:text-green-600 transition-colors truncate">
                                {team.name}
                              </h3>
                              <p className="text-sm text-neutral-500">{team.country}</p>
                            </div>
                          </div>
                          {follow.createdAt && (
                            <div className="text-xs text-neutral-400">
                              Following since {new Date(follow.createdAt).toLocaleDateString()}
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {followedCompetitions.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <Trophy className="w-6 h-6 text-yellow-600" />
                      <h2 className="text-2xl font-bold">Followed Competitions ({followedCompetitions.length})</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {followedCompetitions.map(({ follow, competition }) => (
                        <Link
                          key={follow.id}
                          href={`/competitions/${competition.slug}`}
                          className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-lg hover:border-yellow-300 transition-all group"
                        >
                          <div className="flex items-center gap-4 mb-3">
                            <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center text-white text-2xl">
                              <Trophy className="w-7 h-7" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-neutral-900 group-hover:text-yellow-600 transition-colors truncate">
                                {competition.name}
                              </h3>
                              <p className="text-sm text-neutral-500">{competition.type}</p>
                            </div>
                          </div>
                          {follow.createdAt && (
                            <div className="text-xs text-neutral-400">
                              Following since {new Date(follow.createdAt).toLocaleDateString()}
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== SETTINGS TAB ==================== */}
        {activeTab === "settings" && (
          <div className="space-y-8">
            {/* Change Password */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Lock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Change Password</h2>
                  <p className="text-sm text-neutral-600">Update your password to keep your account secure</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  />
                </div>

                {passwordError && (
                  <p className="text-sm text-red-600">{passwordError}</p>
                )}
                {passwordSuccess && (
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Password changed successfully
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Change Password
                </button>
              </form>
            </div>

            {/* Notification Settings */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Notifications</h2>
                  <p className="text-sm text-neutral-600">Choose what you want to be notified about</p>
                </div>
              </div>

              {notifLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                </div>
              ) : notifSettings ? (
                <div className="divide-y divide-neutral-100">
                  <ToggleRow
                    label="Goals & Assists"
                    description="When followed players score or assist"
                    checked={notifSettings.goals}
                    onChange={(v) => handleToggleNotification("goals", v)}
                  />
                  <ToggleRow
                    label="Match Results"
                    description="Final scores for followed teams"
                    checked={notifSettings.matchResult}
                    onChange={(v) => handleToggleNotification("matchResult", v)}
                  />
                  <ToggleRow
                    label="Milestones"
                    description="Player milestones and records"
                    checked={notifSettings.milestone}
                    onChange={(v) => handleToggleNotification("milestone", v)}
                  />
                  <ToggleRow
                    label="Transfer News"
                    description="Transfer updates for followed entities"
                    checked={notifSettings.transfer}
                    onChange={(v) => handleToggleNotification("transfer", v)}
                  />
                  <ToggleRow
                    label="Upcoming Matches"
                    description="Reminders before matches start"
                    checked={notifSettings.upcomingMatch}
                    onChange={(v) => handleToggleNotification("upcomingMatch", v)}
                  />
                </div>
              ) : null}
            </div>

            {/* Preferences */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Mail className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Preferences</h2>
                  <p className="text-sm text-neutral-600">Customize your experience</p>
                </div>
              </div>

              {notifSettings && (
                <div className="divide-y divide-neutral-100">
                  <ToggleRow
                    label="Email Updates"
                    description="Weekly digest of activity"
                    icon={<Mail className="w-5 h-5 text-neutral-400" />}
                    checked={notifSettings.emailEnabled}
                    onChange={(v) => handleToggleNotification("emailEnabled", v)}
                    color="purple"
                  />
                  <ToggleRow
                    label="Push Notifications"
                    description="Real-time alerts on your device"
                    icon={<Smartphone className="w-5 h-5 text-neutral-400" />}
                    checked={notifSettings.pushEnabled}
                    onChange={(v) => handleToggleNotification("pushEnabled", v)}
                    color="purple"
                  />
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-2xl p-6 border border-red-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-red-900">Danger Zone</h2>
                  <p className="text-sm text-red-600">Irreversible actions</p>
                </div>
              </div>
              <p className="text-sm text-neutral-600 mb-4">
                Once you delete your account, there is no going back. All your data, follows, and predictions will be permanently removed.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        )}

        {/* ==================== BILLING TAB ==================== */}
        {activeTab === "billing" && (
          <div className="space-y-8">
            {/* Current Plan */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold">Current Plan</h2>
                <span
                  className={cn(
                    "px-3 py-1 rounded-full text-sm font-semibold",
                    tier === "free" && "bg-neutral-100 text-neutral-700",
                    tier === "pro" && "bg-blue-100 text-blue-700",
                    tier === "ultimate" && "bg-purple-100 text-purple-700"
                  )}
                >
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </span>
              </div>
              {subscription?.endDate && (
                <p className="text-sm text-neutral-600">
                  {subscription.autoRenew ? "Renews" : "Expires"} on{" "}
                  {new Date(subscription.endDate).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Pricing Cards */}
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-6">
                {tier === "free" ? "Upgrade Your Plan" : "Manage Your Plan"}
              </h2>
              <PricingCards />
            </div>

            {/* Mock Payment Method */}
            {tier !== "free" && (
              <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
                <h2 className="text-xl font-bold mb-4">Payment Method</h2>
                <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl">
                  <div className="w-12 h-8 bg-gradient-to-r from-blue-700 to-blue-900 rounded flex items-center justify-center text-white text-xs font-bold">
                    VISA
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Visa ending in 4242</p>
                    <p className="text-sm text-neutral-500">Expires 12/2027</p>
                  </div>
                </div>
              </div>
            )}

            {/* Mock Invoice History */}
            {tier !== "free" && (
              <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
                <h2 className="text-xl font-bold mb-4">Invoice History</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="text-left py-3 text-neutral-500 font-medium">Date</th>
                        <th className="text-left py-3 text-neutral-500 font-medium">Description</th>
                        <th className="text-right py-3 text-neutral-500 font-medium">Amount</th>
                        <th className="text-right py-3 text-neutral-500 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {[
                        { date: "Mar 1, 2026", desc: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`, amount: tier === "pro" ? "$4.99" : "$9.99" },
                        { date: "Feb 1, 2026", desc: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`, amount: tier === "pro" ? "$4.99" : "$9.99" },
                        { date: "Jan 1, 2026", desc: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`, amount: tier === "pro" ? "$4.99" : "$9.99" },
                      ].map((inv, i) => (
                        <tr key={i}>
                          <td className="py-3 text-neutral-900">{inv.date}</td>
                          <td className="py-3 text-neutral-600">{inv.desc}</td>
                          <td className="py-3 text-right text-neutral-900 font-medium">{inv.amount}</td>
                          <td className="py-3 text-right">
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              Paid
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900">Delete Account</h3>
            </div>

            <p className="text-sm text-neutral-600 mb-6">
              This action is permanent and cannot be undone. All your data will be deleted.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Enter your password
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
                  placeholder="DELETE"
                />
              </div>

              {deleteError && (
                <p className="text-sm text-red-600">{deleteError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletePassword("");
                    setDeleteConfirmation("");
                    setDeleteError("");
                  }}
                  className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmation !== "DELETE" || !deletePassword}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  icon,
  color = "blue",
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
  color?: "blue" | "purple";
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <div className="font-medium text-neutral-900">{label}</div>
          <div className="text-sm text-neutral-600">{description}</div>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div
          className={cn(
            "w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all",
            color === "blue"
              ? "peer-focus:ring-blue-300 peer-checked:bg-blue-600"
              : "peer-focus:ring-purple-300 peer-checked:bg-purple-600"
          )}
        />
      </label>
    </div>
  );
}
