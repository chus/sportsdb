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
  Download,
  Shield,
} from "lucide-react";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { useAuth } from "@/components/auth/auth-provider";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { useUpgradeModal } from "@/components/subscription/upgrade-modal";
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
  const { openUpgradeModal } = useUpgradeModal();
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

  // Data export
  const [exporting, setExporting] = useState(false);

  // Referral
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralStats, setReferralStats] = useState<{
    signups: number;
    subscriptions: number;
    rewardsEarned: number;
    referredUsers: { name: string; joinedAt: string | null; status: string }[];
  } | null>(null);

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
      setReferralCode(user.referralCode || null);
      fetchFollows();
      fetchNotificationSettings();
      fetchProfile();
      fetchReferralStats();
    }
  }, [user]);

  const fetchReferralStats = async () => {
    try {
      const res = await fetch("/api/referral/stats");
      if (res.ok) {
        setReferralStats(await res.json());
      }
    } catch {}
  };

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
      const body: Record<string, string> = { confirmation: deleteConfirmation };
      if (user?.hasPassword) {
        body.password = deletePassword;
      } else {
        body.email = deletePassword; // reuse field for email input
      }
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

            {/* Refer a Friend */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">Refer a Friend</h2>
                  <p className="text-sm text-neutral-600">Share SportsDB and earn rewards</p>
                </div>
              </div>

              {/* Referral Stats */}
              {referralStats && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{referralStats.signups}</p>
                    <p className="text-xs text-green-600">Signed up</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{referralStats.subscriptions}</p>
                    <p className="text-xs text-blue-600">Subscribed</p>
                  </div>
                  <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-center">
                    <p className="text-2xl font-bold text-purple-700">{referralStats.rewardsEarned}</p>
                    <p className="text-xs text-purple-600">Months earned</p>
                  </div>
                </div>
              )}

              <p className="text-sm text-neutral-600 mb-4">
                Share your referral link. When someone subscribes through your link, you get 1 month free.
              </p>

              {referralCode && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      readOnly
                      value={`https://datasports.co?ref=${referralCode}`}
                      className="flex-1 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-700 font-mono"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://datasports.co?ref=${referralCode}`);
                        setReferralCopied(true);
                        setTimeout(() => setReferralCopied(false), 2000);
                      }}
                      className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      {referralCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  {/* Share buttons */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      {
                        label: "WhatsApp",
                        href: `https://wa.me/?text=${encodeURIComponent(`Check out SportsDB — the best football database! https://datasports.co?ref=${referralCode}`)}`,
                        bg: "bg-green-500 hover:bg-green-600",
                      },
                      {
                        label: "Telegram",
                        href: `https://t.me/share/url?url=${encodeURIComponent(`https://datasports.co?ref=${referralCode}`)}&text=${encodeURIComponent("Check out SportsDB — the best football database!")}`,
                        bg: "bg-blue-500 hover:bg-blue-600",
                      },
                      {
                        label: "X",
                        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out SportsDB — the best football database! https://datasports.co?ref=${referralCode}`)}`,
                        bg: "bg-neutral-800 hover:bg-neutral-900",
                      },
                      {
                        label: "Email",
                        href: `mailto:?subject=${encodeURIComponent("Check out SportsDB")}&body=${encodeURIComponent(`I've been using SportsDB and thought you'd like it: https://datasports.co?ref=${referralCode}`)}`,
                        bg: "bg-neutral-600 hover:bg-neutral-700",
                      },
                    ].map((share) => (
                      <a
                        key={share.label}
                        href={share.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3 py-1.5 text-xs font-medium text-white rounded-full transition-colors ${share.bg}`}
                      >
                        {share.label}
                      </a>
                    ))}
                  </div>
                </>
              )}

              {/* Referred users table */}
              {referralStats && referralStats.referredUsers.length > 0 && (
                <div className="border-t border-neutral-200 pt-4">
                  <h3 className="text-sm font-semibold text-neutral-700 mb-2">Your Referrals</h3>
                  <div className="space-y-2">
                    {referralStats.referredUsers.map((ref, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5">
                        <span className="text-neutral-700">{ref.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-neutral-400">
                            {ref.joinedAt ? new Date(ref.joinedAt).toLocaleDateString() : "—"}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full",
                              ref.status === "subscribed"
                                ? "bg-green-100 text-green-700"
                                : "bg-neutral-100 text-neutral-600"
                            )}
                          >
                            {ref.status === "subscribed" ? "Subscribed" : "Signed up"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Privacy & Data */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">Privacy & Data</h2>
                  <p className="text-sm text-neutral-600">Manage your personal data</p>
                </div>
              </div>
              <p className="text-sm text-neutral-600 mb-4">
                Download a copy of all your data or review our privacy policy to understand how we handle your information.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={async () => {
                    if (tier === "free") {
                      openUpgradeModal("export_data");
                      return;
                    }
                    setExporting(true);
                    try {
                      const res = await fetch("/api/account/export");
                      if (!res.ok) throw new Error("Export failed");
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "sportsdb-data-export.json";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    } catch {
                      alert("Failed to export data. Please try again.");
                    } finally {
                      setExporting(false);
                    }
                  }}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {exporting ? "Exporting..." : "Download My Data"}
                </button>
                <Link
                  href="/privacy"
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  Privacy Policy
                </Link>
              </div>
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
          <BillingTab tier={tier} subscription={subscription} />
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
                  {user?.hasPassword ? "Enter your password" : "Enter your email address"}
                </label>
                <input
                  type={user?.hasPassword ? "password" : "email"}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder={user?.hasPassword ? undefined : user?.email}
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

function BillingTab({
  tier,
  subscription,
}: {
  tier: string;
  subscription: { endDate: Date | null; autoRenew: boolean } | null;
}) {
  const [portalLoading, setPortalLoading] = useState(false);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Could not open subscription portal");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Current Plan */}
      <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Current Plan</h2>
          <span
            className={cn(
              "px-3 py-1 rounded-full text-sm font-semibold",
              tier === "free" && "bg-neutral-100 text-neutral-700",
              tier === "pro" && "bg-blue-100 text-blue-700"
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
        {tier !== "free" && (
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className="mt-4 px-5 py-2.5 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Manage Subscription
          </button>
        )}
      </div>

      {/* Pricing Cards */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">
          {tier === "free" ? "Upgrade Your Plan" : "Change Plan"}
        </h2>
        <PricingCards />
        <p className="text-xs text-neutral-500 text-center mt-4">
          By subscribing you agree to our{" "}
          <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
          {" "}Payments are processed securely by Stripe.
        </p>
      </div>
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
