"use client";

import { useState } from "react";
import { User, Mail, Calendar, Check, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

interface ProfileSectionProps {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    createdAt: string;
  };
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const { refreshUser } = useAuth();
  const [name, setName] = useState(user.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || null,
          avatarUrl: avatarUrl || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setMessage({ type: "success", text: "Profile updated successfully" });
      refreshUser();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Account Info */}
      <div className="pb-6 border-b border-neutral-200">
        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-4">
          Account Information
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-neutral-400" />
            <div>
              <p className="text-sm text-neutral-500">Email</p>
              <p className="font-medium text-neutral-900">{user.email}</p>
            </div>
            {user.emailVerified ? (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <Check className="w-3 h-3" />
                Verified
              </span>
            ) : (
              <span className="ml-auto flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                <AlertCircle className="w-3 h-3" />
                Unverified
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-neutral-400" />
            <div>
              <p className="text-sm text-neutral-500">Member since</p>
              <p className="font-medium text-neutral-900">{memberSince}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wide">
          Edit Profile
        </h3>

        {message && (
          <div
            className={`p-4 rounded-lg flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.type === "success" ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-2">
            Display Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full pl-10 pr-4 py-3 border-2 border-neutral-300 rounded-xl bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
            />
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            This is how your name will appear across the site.
          </p>
        </div>

        <div>
          <label htmlFor="avatarUrl" className="block text-sm font-medium text-neutral-700 mb-2">
            Avatar URL
          </label>
          <div className="flex gap-4">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <User className="w-8 h-8 text-neutral-400" />
              )}
            </div>
            <input
              type="url"
              id="avatarUrl"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="flex-1 px-4 py-3 border-2 border-neutral-300 rounded-xl bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
            />
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Enter a URL for your profile picture.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
