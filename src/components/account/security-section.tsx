"use client";

import { useState, useEffect } from "react";
import {
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  Monitor,
  Smartphone,
  Globe,
  X,
  Shield,
} from "lucide-react";

interface SecuritySectionProps {
  user: {
    id: string;
    email: string;
  };
}

interface Session {
  id: string;
  device: string;
  ipAddress: string | null;
  createdAt: string;
  isCurrent: boolean;
}

export function SecuritySection({ user }: SecuritySectionProps) {
  return (
    <div className="space-y-8">
      <ChangePasswordForm />
      <div className="border-t border-neutral-200 pt-8">
        <SessionsManager />
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      setMessage({ type: "success", text: "Password changed successfully. All other sessions have been logged out." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <div>
      <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-4">
        Change Password
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {message && (
          <div
            className={`p-4 rounded-lg flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.type === "success" ? (
              <Check className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-neutral-700 mb-2">
            Current Password
          </label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type={showCurrentPassword ? "text" : "password"}
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full pl-10 pr-12 py-3 border-2 border-neutral-300 rounded-xl bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-neutral-700 mb-2">
            New Password
          </label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type={showNewPassword ? "text" : "password"}
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full pl-10 pr-12 py-3 border-2 border-neutral-300 rounded-xl bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {newPassword && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full ${
                      passwordStrength.level >= level
                        ? passwordStrength.color
                        : "bg-neutral-200"
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs ${passwordStrength.textColor}`}>
                {passwordStrength.label}
              </p>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700 mb-2">
            Confirm New Password
          </label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full pl-10 pr-4 py-3 border-2 border-neutral-300 rounded-xl bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
            />
          </div>
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="mt-1 text-xs text-red-500">Passwords don't match</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading || !currentPassword || !newPassword || newPassword !== confirmPassword}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Change Password
          </button>
        </div>
      </form>
    </div>
  );
}

function SessionsManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/account/sessions");
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      const res = await fetch(`/api/account/sessions?id=${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions(sessions.filter((s) => s.id !== sessionId));
      }
    } catch (error) {
      console.error("Failed to revoke session:", error);
    } finally {
      setRevokingId(null);
    }
  };

  const getDeviceIcon = (device: string) => {
    if (device.toLowerCase().includes("phone") || device.toLowerCase().includes("mobile")) {
      return Smartphone;
    }
    if (device.toLowerCase().includes("tablet") || device.toLowerCase().includes("ipad")) {
      return Smartphone;
    }
    return Monitor;
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-neutral-500" />
        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wide">
          Active Sessions
        </h3>
      </div>

      <p className="text-sm text-neutral-600 mb-4">
        These are the devices currently logged into your account. Revoke any session you don't recognize.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-neutral-500 py-4">No active sessions found.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const DeviceIcon = getDeviceIcon(session.device);
            const loginDate = new Date(session.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={session.id}
                className={`flex items-center gap-4 p-4 rounded-xl border ${
                  session.isCurrent
                    ? "border-green-200 bg-green-50"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    session.isCurrent ? "bg-green-100" : "bg-neutral-100"
                  }`}
                >
                  <DeviceIcon
                    className={`w-5 h-5 ${
                      session.isCurrent ? "text-green-600" : "text-neutral-500"
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-neutral-900">{session.device}</p>
                    {session.isCurrent && (
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    {session.ipAddress && (
                      <>
                        <Globe className="w-3 h-3" />
                        <span>{session.ipAddress}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>{loginDate}</span>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button
                    onClick={() => revokeSession(session.id)}
                    disabled={revokingId === session.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Revoke session"
                  >
                    {revokingId === session.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <X className="w-5 h-5" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getPasswordStrength(password: string): {
  level: number;
  label: string;
  color: string;
  textColor: string;
} {
  if (!password) {
    return { level: 0, label: "", color: "", textColor: "" };
  }

  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) {
    return { level: 1, label: "Weak", color: "bg-red-500", textColor: "text-red-600" };
  }
  if (score <= 2) {
    return { level: 2, label: "Fair", color: "bg-orange-500", textColor: "text-orange-600" };
  }
  if (score <= 3) {
    return { level: 3, label: "Good", color: "bg-yellow-500", textColor: "text-yellow-600" };
  }
  return { level: 4, label: "Strong", color: "bg-green-500", textColor: "text-green-600" };
}
