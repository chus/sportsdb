"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

interface DangerZoneSectionProps {
  user: {
    id: string;
    email: string;
  };
}

export function DangerZoneSection({ user }: DangerZoneSectionProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      // Redirect to home after successful deletion
      router.push("/?deleted=true");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">Danger Zone</h3>
            <p className="text-sm text-red-700 mt-1">
              Actions in this section are irreversible. Please proceed with caution.
            </p>
          </div>
        </div>
      </div>

      {!showDeleteConfirm ? (
        <div className="p-6 border border-red-200 rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-medium text-neutral-900">Delete Account</h4>
              <p className="text-sm text-neutral-600 mt-1">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 border-2 border-red-300 bg-red-50 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h4 className="font-semibold text-red-800">Confirm Account Deletion</h4>
          </div>

          <div className="bg-white p-4 rounded-lg border border-red-200 mb-4">
            <p className="text-sm text-neutral-700 mb-2">
              <strong>This will permanently delete:</strong>
            </p>
            <ul className="text-sm text-neutral-600 list-disc list-inside space-y-1">
              <li>Your account and profile information</li>
              <li>All your followed players, teams, and competitions</li>
              <li>Your activity history and preferences</li>
              <li>All sessions and authentication data</li>
            </ul>
          </div>

          <form onSubmit={handleDeleteAccount} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-lg flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Enter your password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your current password"
                  className="w-full pl-4 pr-12 py-3 border-2 border-neutral-300 rounded-xl bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Type <span className="font-mono bg-neutral-100 px-1 rounded text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
                placeholder="Type DELETE"
                className="w-full px-4 py-3 border-2 border-neutral-300 rounded-xl bg-white text-neutral-900 font-mono placeholder:text-neutral-500 placeholder:font-sans focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-500 transition-all"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setPassword("");
                  setConfirmation("");
                  setError(null);
                }}
                className="flex-1 px-4 py-3 border-2 border-neutral-300 text-neutral-700 font-medium rounded-xl hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !password || confirmation !== "DELETE"}
                className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete My Account
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-6 p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
        <h4 className="font-medium text-neutral-900 mb-2">Need help?</h4>
        <p className="text-sm text-neutral-600">
          If you're having issues with your account or want to export your data before deleting,{" "}
          <a href="/contact" className="text-blue-600 hover:underline">
            contact our support team
          </a>
          .
        </p>
      </div>
    </div>
  );
}
