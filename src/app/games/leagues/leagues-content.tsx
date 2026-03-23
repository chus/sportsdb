"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Users, Lock, Copy, Check, ArrowRight } from "lucide-react";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { useUpgradeModal } from "@/components/subscription/upgrade-modal";
import { useAnalytics } from "@/hooks/use-analytics";
import { useRouter } from "next/navigation";

interface League {
  id: string;
  name: string;
  code: string;
  isPrivate: boolean;
  createdBy: string;
  memberCount: number;
  createdAt: Date | null;
}

interface LeaguesContentProps {
  leagues: League[];
  isLoggedIn: boolean;
}

export function LeaguesContent({ leagues, isLoggedIn }: LeaguesContentProps) {
  const { canAccess } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const { track } = useAnalytics();
  const router = useRouter();
  const isPro = canAccess("games");

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!isPro) {
      track({ eventType: "upgrade_impression", metadata: { feature: "games_prode", context: "league_create" } });
      openUpgradeModal("games_prode", "league_create");
      return;
    }
    if (!newName.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        setShowCreate(false);
        router.refresh();
      } else {
        const data = await res.json();
        if (data.upgradeUrl) openUpgradeModal("games_prode", "league_create_gate");
        else setError(data.error);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!isPro) {
      track({ eventType: "upgrade_impression", metadata: { feature: "games_prode", context: "league_join" } });
      openUpgradeModal("games_prode", "league_join");
      return;
    }
    if (joinCode.length !== 6) return;

    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.toUpperCase() }),
      });
      if (res.ok) {
        setJoinCode("");
        setShowJoin(false);
        router.refresh();
      } else {
        const data = await res.json();
        if (data.upgradeUrl) openUpgradeModal("games_prode", "league_join_gate");
        else setError(data.error);
      }
    } finally {
      setJoining(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            if (!isPro) {
              openUpgradeModal("games_prode", "league_create");
              return;
            }
            setShowCreate(!showCreate);
            setShowJoin(false);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          {!isPro && <Lock className="w-4 h-4" />}
          <Plus className="w-4 h-4" />
          Create League
        </button>
        <button
          onClick={() => {
            if (!isPro) {
              openUpgradeModal("games_prode", "league_join");
              return;
            }
            setShowJoin(!showJoin);
            setShowCreate(false);
          }}
          className="flex items-center gap-2 px-4 py-2.5 border border-neutral-300 text-neutral-700 text-sm font-semibold rounded-lg hover:bg-neutral-50 transition-colors"
        >
          {!isPro && <Lock className="w-4 h-4" />}
          Join League
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="font-semibold text-neutral-900 mb-3">
            Create a League
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="League name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              maxLength={50}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>
      )}

      {/* Join form */}
      {showJoin && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="font-semibold text-neutral-900 mb-3">
            Join a League
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="6-character code"
              value={joinCode}
              onChange={(e) =>
                setJoinCode(e.target.value.toUpperCase().slice(0, 6))
              }
              className="w-40 px-4 py-2.5 border border-neutral-300 rounded-lg text-sm font-mono text-center tracking-widest uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              maxLength={6}
            />
            <button
              onClick={handleJoin}
              disabled={joining || joinCode.length !== 6}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {joining ? "Joining..." : "Join"}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>
      )}

      {/* League list */}
      {leagues.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
          <Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            No leagues yet
          </h3>
          <p className="text-neutral-500 text-sm max-w-sm mx-auto">
            Create a league and share the code with friends to start competing
            together.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/games/leagues/${league.code}`}
              className="group bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors">
                  {league.name}
                </h3>
                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="flex items-center gap-4 text-sm text-neutral-500">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {league.memberCount} members
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    copyCode(league.code);
                  }}
                  className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                >
                  {copiedCode === league.code ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {league.code}
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
